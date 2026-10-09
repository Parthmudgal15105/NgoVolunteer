import mongoose from "mongoose";
const { Schema, model } = mongoose;
const ref = (name, required = true) => ({
  type: Schema.Types.ObjectId,
  ref: name,
  required,
});
const options = { timestamps: true };
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    loginId: { type: String, unique: true, sparse: true, lowercase: true },
    role: {
      type: String,
      enum: ["admin", "head", "volunteer"],
      default: "volunteer",
    },
    founder: { type: Boolean, default: false },
    departments: [String],
    organizationRole: String,
    sourceRows: [Number],
    active: { type: Boolean, default: true },
  },
  options,
);
export const User = model("User", userSchema);
export const VolunteerProfile = model(
  "VolunteerProfile",
  new Schema(
    {
      user: { ...ref("User"), unique: true },
      phone: { type: String, default: "" },
      bio: { type: String, default: "" },
      skills: [String],
      interests: [String],
      availability: { type: String, default: "" },
      state: String,
      joiningDate: String,
    },
    options,
  ),
);
export const SourceRow = model(
  "SourceRow",
  new Schema({
    sheet: { type: String, required: true },
    row: { type: Number, required: true },
    cells: [Schema.Types.Mixed],
  }),
);
SourceRow.schema.index({ sheet: 1, row: 1 }, { unique: true });
export const Event = model(
  "Event",
  new Schema(
    {
      title: { type: String, required: true },
      description: { type: String, required: true },
      category: { type: String, required: true },
      location: { type: String, required: true },
      date: { type: Date, required: true },
      hours: { type: Number, required: true, min: 0.5, max: 24 },
      capacity: { type: Number, required: true, min: 1 },
      status: {
        type: String,
        enum: ["upcoming", "completed"],
        default: "upcoming",
      },
      createdBy: ref("User"),
    },
    options,
  ),
);
const registrationSchema = new Schema(
  {
    event: ref("Event"),
    volunteer: ref("User"),
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  options,
);
registrationSchema.index({ event: 1, volunteer: 1 }, { unique: true });
export const EventRegistration = model("EventRegistration", registrationSchema);
const attendanceSchema = new Schema(
  {
    event: ref("Event"),
    volunteer: ref("User"),
    status: { type: String, enum: ["present", "absent"], required: true },
    hours: { type: Number, required: true, min: 0 },
    markedBy: ref("User"),
  },
  options,
);
attendanceSchema.index({ event: 1, volunteer: 1 }, { unique: true });
export const Attendance = model("Attendance", attendanceSchema);
const certificateSchema = new Schema(
  {
    event: ref("Event"),
    volunteer: ref("User"),
    certificateId: { type: String, unique: true, required: true },
    hours: { type: Number, required: true },
  },
  options,
);
certificateSchema.index({ event: 1, volunteer: 1 }, { unique: true });
export const Certificate = model("Certificate", certificateSchema);
export const Notification = model(
  "Notification",
  new Schema(
    {
      user: ref("User"),
      message: { type: String, required: true },
      read: { type: Boolean, default: false },
    },
    options,
  ),
);
export const Announcement = model(
  "Announcement",
  new Schema(
    {
      title: { type: String, required: true },
      message: { type: String, required: true },
      createdBy: ref("User"),
    },
    options,
  ),
);
