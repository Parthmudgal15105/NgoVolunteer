import { Attendance, Contribution } from "../models/index.js";

export const DEFAULT_EVENT_RP = 5;

export function isSocialDepartment(department) {
  return [
    "social & content",
    "social media",
    "social media department",
  ].includes(
    String(department || "")
      .trim()
      .toLowerCase(),
  );
}

// Points chosen by a head win; older records keep the original fixed rules.
export function contributionRP(record) {
  if (record.status !== "present") return 0;
  if (typeof record.points === "number") return record.points;
  if (record.kind === "drive") return 5;
  if (!isSocialDepartment(record.sourceDepartment)) return 0;
  return { reel_edit: 3, misc: 2 }[record.kind] || 0;
}

export function eventRP(event) {
  return typeof event?.rp === "number" ? event.rp : DEFAULT_EVENT_RP;
}

export function attendanceRP(record) {
  return record.status === "present" ? eventRP(record.event) : 0;
}

// One source of truth for member RP totals, used by tables, reports and certificates.
// Optional per-member windows ({ id: { from, to } }) count only activity inside them.
export async function rpTotals(ids, windows = null) {
  const totals = new Map(ids.map((id) => [String(id), 0]));
  const inside = (id, when) => {
    const w = windows?.[String(id)];
    if (!windows) return true;
    if (!w) return false;
    const t = new Date(when).getTime();
    return (!w.from || t >= w.from.getTime()) && (!w.to || t <= w.to.getTime());
  };
  const add = (id, rp, when) => {
    if (inside(id, when))
      totals.set(String(id), (totals.get(String(id)) || 0) + rp);
  };
  for (const r of await Contribution.find({ volunteer: { $in: ids } }).lean())
    add(r.volunteer, contributionRP(r), r.date);
  for (const r of await Attendance.find({
    volunteer: { $in: ids },
    status: "present",
  })
    .populate("event", "rp date")
    .lean())
    add(r.volunteer, attendanceRP(r), r.event?.date || r.createdAt);
  return totals;
}
