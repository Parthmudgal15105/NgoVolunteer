import { randomUUID } from "node:crypto";
import {
  User,
  VolunteerProfile,
  CertificateRule,
  ProgramCertificate,
  Notification,
  Setting,
} from "../models/index.js";
import { rpTotals } from "./rewards.js";
import { departmentKey } from "./access.js";
import { DEFAULT_TEMPLATE } from "./renderCertificate.js";
export { DEFAULT_TEMPLATE };

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

// Roster joining dates are DD/MM/YYYY strings, sometimes unpadded (12/6/2026).
export function parseJoiningDate(value) {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value;
  const raw = String(value || "").trim();
  const dmy = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy.map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const date = new Date(Date.UTC(y, m - 1, d) - IST_OFFSET);
    return new Date(date.getTime() + IST_OFFSET).getUTCDate() === d
      ? date
      : null;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}
export function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export async function certificateTemplate() {
  const stored = await Setting.findOne({ key: "certificateTemplate" }).lean();
  return { ...DEFAULT_TEMPLATE, ...(stored?.value || {}) };
}

// Resolve each volunteer's tenure: a head's marking wins, the department rule fills gaps.
export async function tenureStatus(users) {
  const ids = users.map((u) => u._id);
  const [profiles, rules, issued] = await Promise.all([
    VolunteerProfile.find({ user: { $in: ids } }).lean(),
    CertificateRule.find({ enabled: true }).lean(),
    ProgramCertificate.find({ volunteer: { $in: ids }, kind: "tenure" }).lean(),
  ]);
  const ruleFor = (user, preferred) => {
    const departments = preferred
      ? [preferred, ...(user.departments || [])]
      : user.departments || [];
    for (const d of departments) {
      const rule = rules.find(
        (r) => departmentKey(r.department) === departmentKey(d),
      );
      if (rule) return rule;
    }
    return null;
  };
  const rows = users.map((user) => {
    const profile = profiles.find((p) => String(p.user) === String(user._id));
    const tenure = profile?.tenure || {};
    const rule = ruleFor(user, tenure.department);
    const start = tenure.start || parseJoiningDate(profile?.joiningDate);
    const months = tenure.months ?? rule?.tenureMonths ?? null;
    const minRP = tenure.minRP ?? rule?.minRP ?? null;
    const department =
      tenure.department || rule?.department || user.departments?.[0] || "";
    const end = start && months != null ? addMonths(start, months) : null;
    return {
      user,
      start,
      months,
      minRP,
      end,
      department,
      marked: !!(tenure.start || tenure.months != null || tenure.minRP != null),
      ruleDepartment: rule?.department || null,
    };
  });
  const windows = Object.fromEntries(
    rows
      .filter((r) => r.start)
      .map((r) => [String(r.user._id), { from: r.start }]),
  );
  const totals = await rpTotals(ids, windows);
  const now = new Date();
  return rows.map((r) => {
    const rp = totals.get(String(r.user._id)) || 0;
    const certificate = issued.find(
      (c) =>
        String(c.volunteer) === String(r.user._id) &&
        r.start &&
        c.periodStart?.getTime() === r.start.getTime(),
    );
    let reason = "";
    if (!r.start) reason = "Joining date missing — mark a tenure start.";
    else if (r.months == null || r.minRP == null)
      reason = "No certificate condition set for this department.";
    else if (now < r.end) reason = "Tenure still running.";
    else if (rp < r.minRP) reason = `Needs ${r.minRP - rp} more RP.`;
    return {
      ...r,
      rp,
      eligible: !reason,
      reason: certificate ? "Certificate issued." : reason,
      certificate: certificate || null,
    };
  });
}

// Issued lazily after RP-changing writes and on certificate reads; no scheduler is needed.
export async function issueTenureCertificates(filter = {}) {
  const users = await User.find({
    ...filter,
    role: "volunteer",
    active: true,
  }).lean();
  if (!users.length) return 0;
  let created = 0;
  for (const s of await tenureStatus(users)) {
    if (!s.eligible || s.certificate) continue;
    try {
      await ProgramCertificate.create({
        volunteer: s.user._id,
        certificateId: `WWC-T-${randomUUID().toUpperCase()}`,
        kind: "tenure",
        title: "Volunteer Tenure",
        department: s.department,
        rp: s.rp,
        periodStart: s.start,
        periodEnd: s.end,
      });
      await Notification.create({
        user: s.user._id,
        message: `Congratulations! Your tenure certificate is ready (${s.rp} RP over ${s.months} months).`,
      });
      created++;
    } catch (error) {
      if (error.code !== 11000) throw error; // A concurrent request issued it first.
    }
  }
  return created;
}
