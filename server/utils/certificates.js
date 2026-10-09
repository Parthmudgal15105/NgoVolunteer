import { randomUUID } from "node:crypto";
import { Attendance, Certificate, Event } from "../models/index.js";
export async function issueCertificates(eventId) {
  const event = await Event.findById(eventId);
  if (event?.status !== "completed") return;
  const records = await Attendance.find({
    event: eventId,
    status: "present",
    hours: { $gt: 0 },
  });
  for (const record of records)
    await Certificate.findOneAndUpdate(
      { event: eventId, volunteer: record.volunteer },
      {
        $set: { hours: record.hours },
        $setOnInsert: { certificateId: `WWC-${randomUUID().toUpperCase()}` },
      },
      { upsert: true, new: true },
    );
}
