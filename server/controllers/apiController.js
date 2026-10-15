import { contributionRP, isSocialDepartment } from "../utils/rewards.js";
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createCertificateDocument } from "../utils/renderCertificate.js";
import mongoose from "mongoose";
import {
  User,
  VolunteerProfile,
  Event,
  EventRegistration,
  Attendance,
  Certificate,
  Notification,
  Announcement,
  SourceRow,
  Contribution,
} from "../models/index.js";
import { auth, admin, manager } from "../middleware/auth.js";
import { issueCertificates } from "../utils/certificates.js";
import {
  managedUsers,
  participationScope,
  requireManaged,
} from "../utils/access.js";
const router = Router();
const fail = (message, status = 400) => {
  const e = new Error(message);
  e.status = status;
  throw e;
};
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const text = (v, max = 500) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const notify = (user, message) => Notification.create({ user, message });
const session = (user) => ({
  token: jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  }),
  user: {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    founder: user.founder,
    departments: user.departments,
  },
});
router.post(
  "/auth/register",
  wrap(async (req, res) => {
    const name = text(req.body.name, 100),
      email = text(req.body.email, 150).toLowerCase(),
      password = req.body.password;
    if (
      !name ||
      !/^\S+@\S+\.\S+$/.test(email) ||
      typeof password !== "string" ||
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72
    )
      fail("Enter a name, valid email, and password with 8–72 characters.");
    if (await User.exists({ email }))
      fail("This email already has an account.", 409);
    const user = await User.create({
      name,
      email,
      loginId: email,
      password: await bcrypt.hash(password, 12),
    });
    await VolunteerProfile.create({
      user: user._id,
      phone: text(req.body.phone, 30),
      interests: text(req.body.interest, 80)
        ? [text(req.body.interest, 80)]
        : [],
    });
    res.status(201).json(session(user));
  }),
);
router.post(
  "/auth/login",
  wrap(async (req, res) => {
    const identifier = text(req.body.email).toLowerCase();
    const matches = await User.find({
      $or: [{ email: identifier }, { loginId: identifier }],
    }).select("+password");
    const user = matches.length === 1 ? matches[0] : null;
    if (
      !user?.active ||
      typeof req.body.password !== "string" ||
      !(await bcrypt.compare(req.body.password, user.password))
    )
      fail("Email or password is incorrect.", 401);
    res.json(session(user));
  }),
);
router.get(
  "/events",
  wrap(async (req, res) => {
    const events = await Event.find().sort({ date: 1 }).lean();
    const counts = await EventRegistration.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: "$event", count: { $sum: 1 } } },
    ]);
    res.json(
      events.map((e) => ({
        ...e,
        approvedCount:
          counts.find((c) => String(c._id) === String(e._id))?.count || 0,
      })),
    );
  }),
);
router.get(
  "/announcements",
  wrap(async (req, res) =>
    res.json(await Announcement.find().sort({ createdAt: -1 })),
  ),
);
router.use(auth);
router.get("/auth/me", (req, res) => res.json(req.user));
router.put(
  "/auth/password",
  wrap(async (req, res) => {
    const user = await User.findById(req.user._id).select("+password");
    const { currentPassword, newPassword } = req.body;
    if (
      typeof currentPassword !== "string" ||
      !(await bcrypt.compare(currentPassword, user.password))
    )
      fail("Current password is incorrect.", 403);
    if (
      typeof newPassword !== "string" ||
      newPassword.length < 12 ||
      Buffer.byteLength(newPassword, "utf8") > 72
    )
      fail("Use a new password with 12–72 characters.");
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({
      message: "Password updated. Use your new password next time you log in.",
    });
  }),
);
router.get(
  "/source-data",
  admin,
  wrap(async (req, res) => {
    const sheets = await SourceRow.distinct("sheet");
    if (!req.query.sheet) return res.json({ sheets });
    const rows = await SourceRow.find({ sheet: text(req.query.sheet, 100) })
      .sort({ row: 1 })
      .lean();
    res.json({ sheets, rows });
  }),
);
router.get(
  "/profile",
  wrap(async (req, res) =>
    res.json((await VolunteerProfile.findOne({ user: req.user._id })) || {}),
  ),
);
router.put(
  "/profile",
  wrap(async (req, res) => {
    const { phone, bio, skills, interests, availability, name } = req.body;
    const fields = {
      phone: text(phone, 30),
      bio: text(bio, 1000),
      availability: text(availability, 300),
      skills: Array.isArray(skills)
        ? skills.slice(0, 20).map((x) => text(x, 60))
        : [],
      interests: Array.isArray(interests)
        ? interests.slice(0, 20).map((x) => text(x, 60))
        : [],
    };
    if (text(name, 100))
      await User.findByIdAndUpdate(req.user._id, { name: text(name, 100) });
    res.json(
      await VolunteerProfile.findOneAndUpdate({ user: req.user._id }, fields, {
        upsert: true,
        new: true,
        runValidators: true,
      }),
    );
  }),
);
function eventFields(body) {
  const fields = {
    title: text(body.title, 150),
    description: text(body.description, 3000),
    category: text(body.category, 80),
    location: text(body.location, 200),
    date: new Date(body.date),
    hours: Number(body.hours),
    capacity: Number(body.capacity),
  };
  if (
    !fields.title ||
    !fields.description ||
    !fields.category ||
    !fields.location ||
    !Number.isFinite(fields.date.getTime()) ||
    !Number.isFinite(fields.hours) ||
    fields.hours < 0.5 ||
    fields.hours > 24 ||
    !Number.isInteger(fields.capacity) ||
    fields.capacity < 1
  )
    fail(
      "Complete all event fields. Hours must be 0.5–24 and capacity a positive whole number.",
    );
  return fields;
}
router.post(
  "/events",
  admin,
  wrap(async (req, res) =>
    res.status(201).json(
      await Event.create({
        ...eventFields(req.body),
        createdBy: req.user._id,
      }),
    ),
  ),
);
router.put(
  "/events/:id",
  admin,
  wrap(async (req, res) => {
    const updated = await exclusive(async () => {
      const event = await Event.findById(req.params.id);
      if (!event) fail("Event not found.", 404);
      const fields = eventFields(req.body);
      const count = await EventRegistration.countDocuments({
        event: event._id,
        status: "approved",
      });
      if (fields.capacity < count)
        fail("Capacity cannot be below approved volunteers.");
      if (
        (await Attendance.exists({ event: event._id })) &&
        fields.hours !== event.hours
      )
        fail("Hours cannot change after attendance has been recorded.");
      Object.assign(event, fields);
      await event.save();
      return event;
    });
    res.json(updated);
  }),
);
router.post(
  "/events/:id/complete",
  admin,
  wrap(async (req, res) => {
    const event = await Event.findById(req.params.id);
    if (!event) fail("Event not found.", 404);
    if (event.date > new Date())
      fail("An event can only be completed after its scheduled time.");
    event.status = "completed";
    await event.save();
    await issueCertificates(event._id);
    res.json(event);
  }),
);
router.delete(
  "/events/:id",
  admin,
  wrap(async (req, res) => {
    if (await EventRegistration.exists({ event: req.params.id }))
      fail(
        "Events with applications must be retained for participation history.",
      );
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) fail("Event not found.", 404);
    res.json({ message: "Event deleted." });
  }),
);
router.get(
  "/registrations",
  wrap(async (req, res) =>
    res.json(
      await EventRegistration.find(await participationScope(req.user))
        .populate("event")
        .populate("volunteer", "name email")
        .sort({ createdAt: -1 }),
    ),
  ),
);
router.post(
  "/events/:id/apply",
  wrap(async (req, res) => {
    if (req.user.role !== "volunteer") fail("Only volunteers may apply.", 403);
    const event = await Event.findById(req.params.id);
    if (!event) fail("Event not found.", 404);
    if (event.status !== "upcoming" || event.date < new Date())
      fail("Applications are closed for this event.");
    if (
      (await EventRegistration.countDocuments({
        event: event._id,
        status: "approved",
      })) >= event.capacity
    )
      fail("This event is full.");
    res.status(201).json(
      await EventRegistration.create({
        event: event._id,
        volunteer: req.user._id,
      }),
    );
  }),
);
// Serialize capacity-affecting actions within this single API process.
let approvalQueue = Promise.resolve();
function exclusive(fn) {
  const result = approvalQueue.then(fn);
  approvalQueue = result.catch(() => {});
  return result;
}
router.patch(
  "/registrations/:id",
  manager,
  wrap(async (req, res) => {
    res.json(
      await exclusive(async () => {
        if (!["approved", "rejected"].includes(req.body.status))
          fail("Choose approved or rejected.");
        const reg = await EventRegistration.findById(req.params.id).populate(
          "event",
        );
        if (!reg) fail("Application not found.", 404);
        await requireManaged(req.user, reg.volunteer);
        if (
          reg.event.status === "completed" ||
          (await Attendance.exists({
            event: reg.event._id,
            volunteer: reg.volunteer,
          }))
        )
          fail("Participation has already been recorded.");
        if (
          req.body.status === "approved" &&
          reg.status !== "approved" &&
          (await EventRegistration.countDocuments({
            event: reg.event._id,
            status: "approved",
          })) >= reg.event.capacity
        )
          fail("Event capacity has been reached.");
        reg.status = req.body.status;
        await reg.save();
        await notify(
          reg.volunteer,
          `Your application for ${reg.event.title} was ${reg.status}.`,
        );
        return reg;
      }),
    );
  }),
);
router.post(
  "/assignments",
  manager,
  wrap(async (req, res) =>
    res.json(
      await exclusive(async () => {
        const event = await Event.findById(req.body.event),
          user = await User.findOne({
            _id: req.body.volunteer,
            role: "volunteer",
            active: true,
          });
        if (!event || !user) fail("Select a valid event and volunteer.");
        await requireManaged(req.user, user._id);
        if (event.status !== "upcoming" || event.date < new Date())
          fail("Assignments are closed.");
        const existing = await EventRegistration.findOne({
          event: event._id,
          volunteer: user._id,
        });
        if (existing?.status === "approved") return existing;
        if (
          (await EventRegistration.countDocuments({
            event: event._id,
            status: "approved",
          })) >= event.capacity
        )
          fail("Event is full.");
        const reg = await EventRegistration.findOneAndUpdate(
          { event: event._id, volunteer: user._id },
          { status: "approved" },
          { upsert: true, new: true },
        );
        await notify(user._id, `You have been assigned to ${event.title}.`);
        return reg;
      }),
    ),
  ),
);
router.get(
  "/volunteers",
  manager,
  wrap(async (req, res) => {
    const users = await User.find(managedUsers(req.user))
      .sort({ "sourceRows.0": 1, name: 1 })
      .lean();
    const profiles = await VolunteerProfile.find({
      user: { $in: users.map((u) => u._id) },
    }).lean();
    const contributions = await Contribution.aggregate([
      {
        $match: {
          volunteer: { $in: users.map((u) => u._id) },
          status: "present",
        },
      },
      {
        $group: {
          _id: "$volunteer",
          drives: { $sum: { $cond: [{ $eq: ["$kind", "drive"] }, 1, 0] } },
          tasks: { $sum: { $cond: [{ $ne: ["$kind", "drive"] }, 1, 0] } },
          hours: { $sum: { $ifNull: ["$hours", 0] } },
          unrecorded: { $sum: { $cond: [{ $eq: ["$hours", null] }, 1, 0] } },
        },
      },
    ]);
    const rewardTotals = new Map();
    const addReward = (id, rp) =>
      rewardTotals.set(String(id), (rewardTotals.get(String(id)) || 0) + rp);
    const ids = users.map((u) => u._id);
    for (const r of await Contribution.find({ volunteer: { $in: ids } }).lean())
      addReward(r.volunteer, contributionRP(r));
    for (const r of await Attendance.find({
      volunteer: { $in: ids },
      status: "present",
    }).lean())
      addReward(r.volunteer, 5);
    const totals = new Map(contributions.map((c) => [String(c._id), c]));
    res.json(
      users.map((u) => ({
        ...u,
        rp: rewardTotals.get(String(u._id)) || 0,
        profile: profiles.find((p) => String(p.user) === String(u._id)),
        contribution: totals.get(String(u._id)) || {
          drives: 0,
          tasks: 0,
          hours: 0,
          unrecorded: 0,
        },
      })),
    );
  }),
);
router.patch(
  "/volunteers/:id",
  manager,
  wrap(async (req, res) => {
    if (typeof req.body.active !== "boolean")
      fail("Active must be true or false.");
    await requireManaged(req.user, req.params.id);
    if (String(req.params.id) === String(req.user._id))
      fail("You cannot deactivate your own account.");
    const user = await User.findOneAndUpdate(
      { _id: req.params.id },
      { active: req.body.active },
      { new: true },
    );
    if (!user) fail("Volunteer not found.", 404);
    res.json(user);
  }),
);
router.get(
  "/attendance",
  wrap(async (req, res) =>
    res.json(
      await Attendance.find(await participationScope(req.user))
        .populate("event")
        .populate("volunteer", "name email")
        .sort({ updatedAt: -1 })
        .lean()
        .then((rows) =>
          rows.map((r) => ({ ...r, rp: r.status === "present" ? 5 : 0 })),
        ),
    ),
  ),
);
router.get(
  "/contributions",
  wrap(async (req, res) => {
    res.json(
      (
        await Contribution.find(await participationScope(req.user))
          .populate("volunteer", "name departments organizationRole")
          .sort({ date: -1 })
          .lean()
      ).map((r) => ({ ...r, rp: contributionRP(r) })),
    );
  }),
);
router.post(
  "/contributions",
  manager,
  wrap(async (req, res) => {
    const { volunteer, kind, status } = req.body;
    await requireManaged(req.user, volunteer);
    const member = await User.findOne({ _id: volunteer, active: true });
    if (!member) fail("Select an active member.");
    if (
      ["reel_edit", "misc"].includes(kind) &&
      !member.departments.some(isSocialDepartment)
    )
      fail(
        "Reel edits and miscellaneous RP are for Social Media members only.",
      );
    const title = text(req.body.title, 180);
    const date = new Date(req.body.date);
    const hours =
      req.body.hours === "" || req.body.hours == null
        ? null
        : Number(req.body.hours);
    if (
      !title ||
      !["drive", "task", "reel_edit", "misc"].includes(kind) ||
      !["present", "absent"].includes(status) ||
      Number.isNaN(date.getTime()) ||
      date > new Date() ||
      (hours !== null && (!Number.isFinite(hours) || hours < 0 || hours > 24))
    )
      fail(
        "Enter an activity, past date, attendance and valid hours (0–24), or leave hours blank.",
      );
    res.status(201).json(
      await Contribution.create({
        volunteer,
        title,
        kind,
        sourceDepartment: ["reel_edit", "misc"].includes(kind)
          ? member.departments.find(isSocialDepartment)
          : undefined,
        date,
        status,
        hours: status === "absent" ? 0 : hours,
        location: text(req.body.location, 180),
        notes: text(req.body.notes, 1000),
        markedBy: req.user._id,
      }),
    );
  }),
);
router.patch(
  "/contributions/:id",
  manager,
  wrap(async (req, res) => {
    const record = await Contribution.findById(req.params.id);
    if (!record) fail("Contribution not found.", 404);
    await requireManaged(req.user, record.volunteer);
    const { status } = req.body;
    const hours =
      req.body.hours === "" || req.body.hours == null
        ? null
        : Number(req.body.hours);
    if (
      !["present", "absent"].includes(status) ||
      (hours !== null && (!Number.isFinite(hours) || hours < 0 || hours > 24))
    )
      fail("Select attendance and valid hours (0–24), or leave hours blank.");
    const kind = req.body.kind || record.kind;
    if (!["drive", "task", "reel_edit", "misc"].includes(kind))
      fail("Select a valid activity type.");
    if (["reel_edit", "misc"].includes(kind)) {
      const member = await User.findById(record.volunteer);
      const department = member.departments.find(isSocialDepartment);
      if (!department)
        fail(
          "Reel edits and miscellaneous RP are for Social Media members only.",
        );
      record.sourceDepartment = department;
    }
    record.kind = kind;
    record.status = status;
    record.hours = status === "absent" ? 0 : hours;
    record.notes = text(req.body.notes, 1000);
    record.markedBy = req.user._id;
    await record.save();
    res.json(record);
  }),
);
router.put(
  "/attendance",
  manager,
  wrap(async (req, res) => {
    const { event: eventId, volunteer, status } = req.body;
    await requireManaged(req.user, volunteer);
    if (!["present", "absent"].includes(status))
      fail("Select present or absent.");
    const event = await Event.findById(eventId);
    if (!event || event.date > new Date())
      fail("Attendance is available after the scheduled event time.");
    if (
      !(await EventRegistration.exists({
        event: eventId,
        volunteer,
        status: "approved",
      }))
    )
      fail("Attendance requires an approved application.");
    const record = await Attendance.findOneAndUpdate(
      { event: eventId, volunteer },
      {
        status,
        hours: status === "present" ? event.hours : 0,
        markedBy: req.user._id,
      },
      { upsert: true, new: true, runValidators: true },
    );
    if (status === "absent")
      await Certificate.deleteOne({ event: eventId, volunteer });
    await issueCertificates(eventId);
    res.json(record);
  }),
);
router.get(
  "/certificates",
  wrap(async (req, res) =>
    res.json(
      await Certificate.find(await participationScope(req.user))
        .populate("event")
        .populate("volunteer", "name email")
        .sort({ createdAt: -1 }),
    ),
  ),
);
router.get(
  "/certificates/:id/download",
  wrap(async (req, res) => {
    const cert = await Certificate.findById(req.params.id)
      .populate("event")
      .populate("volunteer", "name");
    if (!cert) fail("Certificate not found.", 404);
    if (String(cert.volunteer._id) !== String(req.user._id))
      await requireManaged(req.user, cert.volunteer._id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${cert.certificateId}.pdf"`,
    );
    const doc = createCertificateDocument(cert);
    doc.pipe(res);
    doc.end();
  }),
);
router.get(
  "/notifications",
  wrap(async (req, res) =>
    res.json(
      await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }),
    ),
  ),
);
router.patch(
  "/notifications/:id/read",
  wrap(async (req, res) => {
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true },
      { new: true },
    );
    if (!n) fail("Notification not found.", 404);
    res.json(n);
  }),
);
router.post(
  "/announcements",
  admin,
  wrap(async (req, res) => {
    const title = text(req.body.title, 150),
      message = text(req.body.message, 3000);
    if (!title || !message) fail("Title and message are required.");
    res
      .status(201)
      .json(
        await Announcement.create({ title, message, createdBy: req.user._id }),
      );
  }),
);
router.delete(
  "/announcements/:id",
  admin,
  wrap(async (req, res) => {
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ message: "Announcement deleted." });
  }),
);
router.get(
  "/dashboard",
  wrap(async (req, res) => {
    const isAdmin = ["admin", "head"].includes(req.user.role),
      filter = await participationScope(req.user);
    const [
      attendance,
      registrations,
      certificates,
      events,
      volunteers,
      contributions,
    ] = await Promise.all([
      Attendance.find(filter).populate("event"),
      EventRegistration.find(filter).populate("event"),
      Certificate.countDocuments(filter),
      Event.find().sort({ date: 1 }),
      isAdmin ? User.find(managedUsers(req.user)) : [],
      Contribution.find(filter).lean(),
    ]);
    const hours = attendance.reduce((n, a) => n + a.hours, 0),
      present = attendance.filter((a) => a.status === "present");
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - 5 + i, 1);
      return {
        month: d.toLocaleString("en", { month: "short" }),
        hours: attendance
          .filter(
            (a) =>
              a.event &&
              a.event.date.getMonth() === d.getMonth() &&
              a.event.date.getFullYear() === d.getFullYear(),
          )
          .reduce((n, a) => n + a.hours, 0),
      };
    });
    const currentYear = new Date().toLocaleDateString("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
    });
    const inCurrentYear = (date) =>
      date &&
      new Date(date).toLocaleDateString("en-US", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
      }) === currentYear;
    const drivesCompletedThisYear =
      present.filter((a) => inCurrentYear(a.event?.date)).length +
      contributions.filter(
        (r) =>
          r.kind === "drive" && r.status === "present" && inCurrentYear(r.date),
      ).length;
    res.json({
      drivesCompletedThisYear,
      rp:
        present.length * 5 +
        contributions.reduce((sum, r) => sum + contributionRP(r), 0),
      hours,
      participated: present.length,
      joined: registrations.filter((r) => r.status === "approved").length,
      certificates,
      upcoming: events.filter(
        (e) =>
          e.status === "upcoming" &&
          e.date >= new Date() &&
          (isAdmin ||
            registrations.some(
              (r) =>
                r.status === "approved" &&
                String(r.event?._id) === String(e._id),
            )),
      ).length,
      completed: events.filter((e) => e.status === "completed").length,
      totalVolunteers: volunteers.length,
      activeVolunteers: volunteers.filter((v) => v.active).length,
      attendancePercentage: attendance.length
        ? Math.round((present.length / attendance.length) * 100)
        : 0,
      pending: registrations.filter((r) => r.status === "pending").length,
      months,
      upcomingEvents: events
        .filter(
          (e) =>
            e.status === "upcoming" &&
            e.date >= new Date() &&
            (isAdmin ||
              registrations.some(
                (r) =>
                  r.status === "approved" &&
                  String(r.event?._id) === String(e._id),
              )),
        )
        .slice(0, 4),
      categories: events.reduce((acc, e) => {
        const entry = acc.find((x) => x.name === e.category);
        if (entry) entry.value++;
        else acc.push({ name: e.category, value: 1 });
        return acc;
      }, []),
    });
  }),
);
router.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.code === 11000)
    return res
      .status(409)
      .json({ message: "This email or registration already exists." });
  if (err instanceof mongoose.Error.CastError)
    return res.status(400).json({ message: "Invalid record identifier." });
  if (err instanceof mongoose.Error.ValidationError)
    return res
      .status(400)
      .json({
        message:
          process.env.NODE_ENV === "production"
            ? "Invalid record data."
            : err.message,
      });
  if (!err.status)
    console.error("API request failed", { name: err.name, code: err.code });
  res.status(err.status || 500).json({
    message: err.status
      ? err.message
      : "Something went wrong. Please try again.",
  });
});
export default router;
