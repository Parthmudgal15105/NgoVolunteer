// Member management, reports, RP activities and certificate conditions.
// Mounted after authentication by apiController.
import { Router } from "express";
import bcrypt from "bcrypt";
import { randomBytes, randomUUID } from "node:crypto";
import {
  User,
  VolunteerProfile,
  Attendance,
  Contribution,
  Certificate,
  EventRegistration,
  RpRule,
  CertificateRule,
  ProgramCertificate,
  Notification,
  Setting,
} from "../models/index.js";
import { fail, wrap, text, optionalNumber } from "../utils/http.js";
import {
  managedUsers,
  participationScope,
  requireManaged,
  requirePermission,
  ownsDepartment,
  isHR,
  sameDepartment,
  departmentKey,
} from "../utils/access.js";
import { contributionRP, attendanceRP } from "../utils/rewards.js";
import {
  tenureStatus,
  issueTenureCertificates,
  certificateTemplate,
  DEFAULT_TEMPLATE,
} from "../utils/programCertificates.js";
import { createCertificateDocument } from "../utils/renderCertificate.js";

const router = Router();
const managers = requirePermission("manageMembers");
const IST_OFFSET = 5.5 * 60 * 60 * 1000;

// "2026-11" → IST calendar-month boundaries.
function monthRange(value) {
  const now = new Date(Date.now() + IST_OFFSET);
  const match = String(value || "").match(/^(\d{4})-(\d{2})$/);
  const year = match ? Number(match[1]) : now.getUTCFullYear();
  const month = match ? Number(match[2]) - 1 : now.getUTCMonth();
  if (month < 0 || month > 11) fail("Choose a valid month.");
  return {
    key: `${year}-${String(month + 1).padStart(2, "0")}`,
    from: new Date(Date.UTC(year, month, 1) - IST_OFFSET),
    to: new Date(Date.UTC(year, month + 1, 1) - IST_OFFSET),
  };
}
const monthKey = (date) => {
  const d = new Date(new Date(date).getTime() + IST_OFFSET);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
export function activityLevel(activities) {
  if (activities >= 4) return "Highly active";
  if (activities >= 2) return "Active";
  if (activities === 1) return "Occasional";
  return "Inactive";
}
// Event attendance and logged contributions as one dated list.
async function activityRows(filter) {
  const [attendance, contributions] = await Promise.all([
    Attendance.find(filter).populate("event").lean(),
    Contribution.find(filter).lean(),
  ]);
  return [
    ...attendance.map((a) => ({
      _id: a._id,
      volunteer: String(a.volunteer),
      source: "event",
      kind: "event",
      title: a.event?.title || "Event",
      label: a.event?.category || "Event",
      date: a.event?.date || a.createdAt,
      status: a.status,
      hours: a.hours || 0,
      rp: attendanceRP(a),
      location: a.event?.location,
    })),
    ...contributions.map((c) => ({
      _id: c._id,
      volunteer: String(c.volunteer),
      source: "contribution",
      kind: c.kind,
      title: c.title,
      label:
        c.ruleLabel ||
        {
          drive: "Drive",
          task: "Department task",
          reel_edit: "Reel edit",
          misc: "Miscellaneous",
          custom: "Custom activity",
        }[c.kind],
      date: c.date,
      status: c.status,
      hours: c.hours,
      rp: contributionRP(c),
      location: c.location,
      notes: c.notes,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));
}
function summarize(rows) {
  const present = rows.filter((r) => r.status === "present");
  return {
    activities: present.length,
    events: present.filter((r) => r.source === "event").length,
    drives: present.filter((r) => r.kind === "drive").length,
    tasks: present.filter(
      (r) => r.source === "contribution" && r.kind !== "drive",
    ).length,
    absences: rows.filter((r) => r.status === "absent").length,
    hours: present.reduce((n, r) => n + (r.hours || 0), 0),
    rp: rows.reduce((n, r) => n + (r.rp || 0), 0),
    attendanceRate: rows.length
      ? Math.round((present.length / rows.length) * 100)
      : null,
    lastActivity: present[0]?.date || null,
  };
}

// 1. Heads add new volunteers to their own departments.
router.post(
  "/volunteers",
  requirePermission("addVolunteers"),
  wrap(async (req, res) => {
    const name = text(req.body.name, 100);
    const email = text(req.body.email, 150).toLowerCase();
    const departments = [
      ...new Set(
        (Array.isArray(req.body.departments)
          ? req.body.departments
          : [req.body.department]
        )
          .map((d) => text(d, 80))
          .filter(Boolean),
      ),
    ];
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || !departments.length)
      fail("Enter a name, valid email and at least one department.");
    for (const department of departments)
      if (!isHR(req.user) && !ownsDepartment(req.user, department))
        fail("You can only add volunteers to your own department.", 403);
    if (await User.exists({ $or: [{ email }, { loginId: email }] }))
      fail("This email already has an account.", 409);
    const temporaryPassword = randomBytes(12).toString("base64url");
    const user = await User.create({
      name,
      email,
      loginId: email,
      password: await bcrypt.hash(temporaryPassword, 12),
      role: "volunteer",
      departments,
      organizationRole: text(req.body.organizationRole, 60) || "Volunteer",
    });
    await VolunteerProfile.create({
      user: user._id,
      phone: text(req.body.phone, 30),
      state: text(req.body.state, 60),
      joiningDate: text(req.body.joiningDate, 20),
    });
    await Notification.create({
      user: user._id,
      message: `Welcome to Warriors Without Cause! ${req.user.name} added you to ${departments.join(", ")}.`,
    });
    // The temporary password is shown once to the head and never stored in plain text.
    res.status(201).json({
      user: {
        _id: user._id,
        name,
        email,
        loginId: user.loginId,
        departments,
      },
      temporaryPassword,
    });
  }),
);

// 10. Detailed report for one volunteer (managers, or the volunteer themself).
router.get(
  "/volunteers/:id/report",
  wrap(async (req, res) => {
    if (String(req.params.id) !== String(req.user._id))
      await requireManaged(req.user, req.params.id);
    const member = await User.findById(req.params.id).lean();
    if (!member) fail("Volunteer not found.", 404);
    await issueTenureCertificates({ _id: member._id });
    const filter = { volunteer: member._id };
    const [profile, rows, certificates, programCertificates, applications] =
      await Promise.all([
        VolunteerProfile.findOne({ user: member._id }).lean(),
        activityRows(filter),
        Certificate.find(filter).populate("event", "title date").lean(),
        ProgramCertificate.find(filter).lean(),
        EventRegistration.find(filter).populate("event", "title date").lean(),
      ]);
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.now() + IST_OFFSET);
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() - 11 + i);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const inMonth = rows.filter((r) => monthKey(r.date) === key);
      const s = summarize(inMonth);
      return {
        month: key,
        label: d.toLocaleString("en", { month: "short", timeZone: "UTC" }),
        rp: s.rp,
        hours: s.hours,
        activities: s.activities,
        level: activityLevel(s.activities),
      };
    });
    const byActivity = Object.values(
      rows
        .filter((r) => r.status === "present")
        .reduce((acc, r) => {
          acc[r.label] ||= { label: r.label, count: 0, rp: 0, hours: 0 };
          acc[r.label].count++;
          acc[r.label].rp += r.rp;
          acc[r.label].hours += r.hours || 0;
          return acc;
        }, {}),
    ).sort((a, b) => b.rp - a.rp);
    const [tenure] =
      member.role === "volunteer" ? await tenureStatus([member]) : [];
    const { password, ...safe } = member;
    res.json({
      member: safe,
      profile: profile || {},
      totals: {
        ...summarize(rows),
        certificates: certificates.length + programCertificates.length,
        applications: applications.length,
      },
      months,
      byActivity,
      activity: rows,
      certificates: [
        ...certificates.map((c) => ({
          _id: c._id,
          type: "event",
          title: c.overrideTitle || c.event?.title,
          date: c.event?.date,
          certificateId: c.certificateId,
        })),
        ...programCertificates.map((c) => ({
          _id: c._id,
          type: c.kind,
          title: c.title,
          date: c.periodEnd || c.createdAt,
          certificateId: c.certificateId,
        })),
      ],
      applications: applications.map((a) => ({
        _id: a._id,
        status: a.status,
        event: a.event?.title,
        date: a.event?.date,
      })),
      tenure: tenure
        ? {
            start: tenure.start,
            end: tenure.end,
            months: tenure.months,
            minRP: tenure.minRP,
            department: tenure.department,
            rp: tenure.rp,
            eligible: tenure.eligible,
            reason: tenure.reason,
            marked: tenure.marked,
          }
        : null,
    });
  }),
);

// 7. Monthly activity report, with a department rollup for heads.
router.get(
  "/reports/monthly",
  managers,
  wrap(async (req, res) => {
    const { key, from, to } = monthRange(req.query.month);
    const department = text(req.query.department, 80);
    let members = await User.find({
      ...managedUsers(req.user),
      role: "volunteer",
    })
      .select("name email departments organizationRole active loginId")
      .sort({ name: 1 })
      .lean();
    if (department)
      members = members.filter((m) =>
        m.departments?.some((d) => sameDepartment(d, department)),
      );
    const ids = members.map((m) => m._id);
    const rows = (await activityRows({ volunteer: { $in: ids } })).filter(
      (r) => new Date(r.date) >= from && new Date(r.date) < to,
    );
    const memberRows = members.map((m) => {
      const s = summarize(rows.filter((r) => r.volunteer === String(m._id)));
      return { ...m, ...s, level: activityLevel(s.activities) };
    });
    const visibleDepartments =
      req.user.role === "head" && !isHR(req.user)
        ? req.user.departments || []
        : [...new Set(members.flatMap((m) => m.departments || []))];
    const departments = visibleDepartments
      .map((name) => {
        const inDept = memberRows.filter((m) =>
          m.departments?.some((d) => sameDepartment(d, name)),
        );
        return {
          name,
          members: inDept.length,
          activeMembers: inDept.filter((m) => m.activities >= 2).length,
          inactiveMembers: inDept.filter((m) => m.activities === 0).length,
          activities: inDept.reduce((n, m) => n + m.activities, 0),
          rp: inDept.reduce((n, m) => n + m.rp, 0),
          hours: inDept.reduce((n, m) => n + m.hours, 0),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json({
      month: key,
      from,
      to,
      members: memberRows,
      departments,
      totals: {
        members: memberRows.length,
        active: memberRows.filter((m) => m.activities >= 2).length,
        inactive: memberRows.filter((m) => m.activities === 0).length,
        activities: memberRows.reduce((n, m) => n + m.activities, 0),
        rp: memberRows.reduce((n, m) => n + m.rp, 0),
        hours: memberRows.reduce((n, m) => n + m.hours, 0),
      },
    });
  }),
);

// 8. RP activities each department head defines for their own department.
router.get(
  "/rp-rules",
  managers,
  wrap(async (req, res) =>
    res.json(await RpRule.find().sort({ department: 1, label: 1 }).lean()),
  ),
);
router.post(
  "/rp-rules",
  requirePermission("manageRpRules"),
  wrap(async (req, res) => {
    const department = text(req.body.department, 80);
    const label = text(req.body.label, 120);
    const points = optionalNumber(req.body.points, 0, 100, "RP");
    if (!department || !label || points === null)
      fail("Enter a department, activity name and RP (0–100).");
    if (!ownsDepartment(req.user, department))
      fail("You can only set RP activities for your own department.", 403);
    res.status(201).json(
      await RpRule.create({
        department,
        label,
        points,
        createdBy: req.user._id,
      }),
    );
  }),
);
router.delete(
  "/rp-rules/:id",
  requirePermission("manageRpRules"),
  wrap(async (req, res) => {
    const rule = await RpRule.findById(req.params.id);
    if (!rule) fail("RP activity not found.", 404);
    if (!ownsDepartment(req.user, rule.department))
      fail("You can only change RP activities for your own department.", 403);
    await rule.deleteOne();
    res.json({ message: "RP activity removed. Logged RP is unchanged." });
  }),
);

// 3 & 12. Certificate conditions: minimum RP and tenure length, per department.
router.get(
  "/certificate-rules",
  managers,
  wrap(async (req, res) =>
    res.json(await CertificateRule.find().sort({ department: 1 }).lean()),
  ),
);
router.put(
  "/certificate-rules",
  managers,
  wrap(async (req, res) => {
    const department = text(req.body.department, 80);
    const minRP = optionalNumber(req.body.minRP, 0, 10000, "Minimum RP");
    const tenureMonths = optionalNumber(
      req.body.tenureMonths,
      0,
      120,
      "Tenure months",
    );
    if (!department || minRP === null || tenureMonths === null)
      fail("Enter a department, minimum RP and tenure in months.");
    if (!ownsDepartment(req.user, department))
      fail("You can only set conditions for your own department.", 403);
    const existing = (await CertificateRule.find().lean()).find(
      (r) => departmentKey(r.department) === departmentKey(department),
    );
    const rule = await CertificateRule.findOneAndUpdate(
      { department: existing?.department || department },
      {
        minRP,
        tenureMonths,
        enabled: req.body.enabled !== false,
        updatedBy: req.user._id,
      },
      { upsert: true, new: true, runValidators: true },
    );
    await issueTenureCertificates({ departments: rule.department });
    res.json(rule);
  }),
);
// Heads mark an individual volunteer's tenure; blank fields use the department rule.
router.put(
  "/volunteers/:id/tenure",
  managers,
  wrap(async (req, res) => {
    await requireManaged(req.user, req.params.id);
    const member = await User.findOne({
      _id: req.params.id,
      role: "volunteer",
    });
    if (!member) fail("Volunteer not found.", 404);
    const start = req.body.start ? new Date(req.body.start) : null;
    if (start && Number.isNaN(start.getTime()))
      fail("Enter a valid tenure start date.");
    const department = text(req.body.department, 80);
    if (
      department &&
      !member.departments.some((d) => sameDepartment(d, department))
    )
      fail("Choose one of this volunteer's departments.");
    const tenure = {
      start: start || undefined,
      months:
        optionalNumber(req.body.months, 0, 120, "Tenure months") ?? undefined,
      minRP:
        optionalNumber(req.body.minRP, 0, 10000, "Minimum RP") ?? undefined,
      department: department || undefined,
      markedBy: req.user._id,
    };
    const profile = await VolunteerProfile.findOneAndUpdate(
      { user: member._id },
      { $set: { tenure } },
      { upsert: true, new: true, runValidators: true },
    );
    await issueTenureCertificates({ _id: member._id });
    res.json(profile.tenure);
  }),
);
router.get(
  "/certificate-status",
  managers,
  wrap(async (req, res) => {
    await issueTenureCertificates(await scopedFilter(req.user));
    const members = await User.find({
      ...managedUsers(req.user),
      role: "volunteer",
      active: true,
    })
      .sort({ name: 1 })
      .lean();
    res.json(
      (await tenureStatus(members)).map((s) => ({
        volunteer: {
          _id: s.user._id,
          name: s.user.name,
          departments: s.user.departments,
        },
        start: s.start,
        end: s.end,
        months: s.months,
        minRP: s.minRP,
        department: s.department,
        rp: s.rp,
        marked: s.marked,
        eligible: s.eligible,
        reason: s.reason,
        certificate: s.certificate?._id || null,
      })),
    );
  }),
);

// Program certificates: automatic tenure certificates and ones heads/HR issue directly.
async function scopedFilter(user) {
  if (user.role === "volunteer") return { _id: user._id };
  return { ...managedUsers(user), role: "volunteer" };
}
router.get(
  "/program-certificates",
  wrap(async (req, res) => {
    await issueTenureCertificates(await scopedFilter(req.user));
    res.json(
      await ProgramCertificate.find(await participationScope(req.user))
        .populate("volunteer", "name email departments")
        .sort({ createdAt: -1 })
        .lean(),
    );
  }),
);
function certificateFields(body) {
  return {
    title: text(body.title, 150),
    period: text(body.period, 60),
    department: text(body.department, 80),
    description: text(body.description, 600),
    displayName: text(body.displayName, 100),
    note: text(body.note, 500),
    hours: optionalNumber(body.hours, 0, 10000, "Hours"),
  };
}
router.post(
  "/program-certificates",
  requirePermission("issueCertificates"),
  wrap(async (req, res) => {
    await requireManaged(req.user, req.body.volunteer);
    const member = await User.findOne({
      _id: req.body.volunteer,
      role: "volunteer",
    });
    if (!member) fail("Select a volunteer.");
    const fields = certificateFields(req.body);
    if (!fields.title) fail("Enter what the certificate is for.");
    const certificate = await ProgramCertificate.create({
      ...fields,
      department: fields.department || member.departments?.[0] || "",
      volunteer: member._id,
      kind: "manual",
      certificateId: `WWC-M-${randomUUID().toUpperCase()}`,
      issuedBy: req.user._id,
    });
    await Notification.create({
      user: member._id,
      message: `You received a certificate: ${fields.title}.`,
    });
    res.status(201).json(certificate);
  }),
);
// 6. Only heads, founders and BOD edit certificates.
router.patch(
  "/program-certificates/:id",
  requirePermission("editCertificates"),
  wrap(async (req, res) => {
    const certificate = await ProgramCertificate.findById(req.params.id);
    if (!certificate) fail("Certificate not found.", 404);
    await requireManaged(req.user, certificate.volunteer);
    const fields = certificateFields(req.body);
    if (!fields.title) fail("Certificate title is required.");
    Object.assign(certificate, fields, {
      editedBy: req.user._id,
      editedAt: new Date(),
    });
    await certificate.save();
    res.json(certificate);
  }),
);
router.delete(
  "/program-certificates/:id",
  requirePermission("issueCertificates"),
  wrap(async (req, res) => {
    const certificate = await ProgramCertificate.findById(req.params.id);
    if (!certificate) fail("Certificate not found.", 404);
    await requireManaged(req.user, certificate.volunteer);
    if (certificate.kind !== "manual")
      fail(
        "Tenure certificates follow their conditions. Change the tenure or RP condition instead.",
      );
    await certificate.deleteOne();
    res.json({ message: "Certificate withdrawn." });
  }),
);
function sendPdf(res, doc, filename) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);
  doc.end();
}
router.get(
  "/program-certificates/:id/download",
  wrap(async (req, res) => {
    const certificate = await ProgramCertificate.findById(
      req.params.id,
    ).populate("volunteer", "name");
    if (!certificate) fail("Certificate not found.", 404);
    if (String(certificate.volunteer._id) !== String(req.user._id))
      await requireManaged(req.user, certificate.volunteer._id);
    sendPdf(
      res,
      createCertificateDocument(certificate, await certificateTemplate()),
      `${certificate.certificateId}.pdf`,
    );
  }),
);
router.patch(
  "/certificates/:id",
  requirePermission("editCertificates"),
  wrap(async (req, res) => {
    const certificate = await Certificate.findById(req.params.id);
    if (!certificate) fail("Certificate not found.", 404);
    await requireManaged(req.user, certificate.volunteer);
    certificate.displayName = text(req.body.displayName, 100);
    certificate.overrideTitle = text(req.body.overrideTitle, 150);
    certificate.description = text(req.body.description, 600);
    certificate.note = text(req.body.note, 500);
    certificate.overrideHours = optionalNumber(
      req.body.overrideHours,
      0,
      10000,
      "Hours",
    );
    certificate.editedBy = req.user._id;
    certificate.editedAt = new Date();
    await certificate.save();
    res.json(certificate);
  }),
);

// 5. Certificate format (wording); layout, seal and signatures stay fixed.
router.get(
  "/certificate-template",
  managers,
  wrap(async (req, res) =>
    res.json({
      template: await certificateTemplate(),
      defaults: DEFAULT_TEMPLATE,
    }),
  ),
);
const templateFields = (body) =>
  Object.fromEntries(
    Object.keys(DEFAULT_TEMPLATE).map((k) => [
      k,
      text(body[k], k.endsWith("Body") ? 600 : 120) || DEFAULT_TEMPLATE[k],
    ]),
  );
router.put(
  "/certificate-template",
  requirePermission("certificateFormat"),
  wrap(async (req, res) => {
    const value = templateFields(req.body);
    await Setting.findOneAndUpdate(
      { key: "certificateTemplate" },
      { value, updatedBy: req.user._id },
      { upsert: true },
    );
    res.json({ template: value, defaults: DEFAULT_TEMPLATE });
  }),
);
router.post(
  "/certificate-template/preview",
  managers,
  wrap(async (req, res) => {
    const template = templateFields(req.body);
    const kind = ["event", "tenure", "manual"].includes(req.body.kind)
      ? req.body.kind
      : "manual";
    const sample = {
      certificateId: "SAMPLE-PREVIEW",
      volunteer: { name: "Sample Volunteer" },
      ...(kind === "event"
        ? { event: { title: "Sample Drive", date: new Date() }, hours: 3 }
        : {
            kind,
            title: "Volunteer of the Month",
            department: req.user.departments?.[0] || "Operations",
            period: new Date().toLocaleDateString("en-IN", {
              month: "long",
              year: "numeric",
            }),
            rp: 40,
            periodStart: new Date(Date.now() - 91 * 86400000),
            periodEnd: new Date(),
          }),
    };
    sendPdf(
      res,
      createCertificateDocument(sample, template),
      "certificate-preview.pdf",
    );
  }),
);

export default router;
