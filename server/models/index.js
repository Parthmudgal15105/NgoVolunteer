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
      // Certificate tenure marked by a head; blank fields fall back to the department rule.
      tenure: {
        start: Date,
        months: { type: Number, min: 0, max: 120 },
        minRP: { type: Number, min: 0, max: 10000 },
        department: String,
        markedBy: { type: Schema.Types.ObjectId, ref: "User" },
      },
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
      // Reward points for each present volunteer; missing on older events means 5.
      rp: { type: Number, min: 0, max: 100, default: 5 },
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
const contributionSchema = new Schema(
  {
    volunteer: ref("User"),
    title: { type: String, required: true },
    kind: {
      type: String,
      enum: ["drive", "task", "reel_edit", "misc", "custom"],
      required: true,
    },
    // Points chosen by the head when logging. Null keeps the legacy kind-based RP.
    points: { type: Number, min: 0, max: 100, default: null },
    ruleLabel: String,
    date: { type: Date, required: true },
    status: { type: String, enum: ["present", "absent"], required: true },
    hours: { type: Number, min: 0, max: 24, default: null },
    location: String,
    notes: String,
    sourceKey: { type: String, unique: true, sparse: true },
    sourceDepartment: String,
    markedBy: ref("User", false),
  },
  options,
);
export const Contribution = model("Contribution", contributionSchema);
const certificateSchema = new Schema(
  {
    event: ref("Event"),
    volunteer: ref("User"),
    certificateId: { type: String, unique: true, required: true },
    hours: { type: Number, required: true },
    // Manual corrections by heads, founders or BOD. Attendance saves never overwrite these.
    displayName: String,
    overrideHours: { type: Number, min: 0, max: 10000, default: null },
    overrideTitle: String,
    description: String,
    note: String,
    editedBy: ref("User", false),
    editedAt: Date,
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

const rpRuleSchema = new Schema(
  {
    department: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    points: { type: Number, required: true, min: 0, max: 100 },
    createdBy: ref("User"),
  },
  options,
);
rpRuleSchema.index({ department: 1, label: 1 }, { unique: true });
export const RpRule = model("RpRule", rpRuleSchema);
// Certificates not tied to one event: automatic tenure certificates and HR-issued ones.
const programCertificateSchema = new Schema(
  {
    volunteer: ref("User"),
    certificateId: { type: String, unique: true, required: true },
    kind: { type: String, enum: ["tenure", "manual"], required: true },
    title: { type: String, required: true },
    description: String,
    rp: { type: Number, default: 0 },
    hours: { type: Number, default: null },
    department: String,
    period: String,
    periodStart: Date,
    periodEnd: Date,
    displayName: String,
    note: String,
    issuedBy: ref("User", false),
    editedBy: ref("User", false),
    editedAt: Date,
  },
  options,
);
programCertificateSchema.index(
  { volunteer: 1, periodStart: 1 },
  { unique: true, partialFilterExpression: { kind: "tenure" } },
);
export const ProgramCertificate = model(
  "ProgramCertificate",
  programCertificateSchema,
);
export const Setting = model(
  "Setting",
  new Schema(
    {
      key: { type: String, required: true, unique: true },
      value: Schema.Types.Mixed,
      updatedBy: ref("User", false),
    },
    options,
  ),
);
export const CertificateRule = model(
  "CertificateRule",
  new Schema(
    {
      department: { type: String, required: true, unique: true, trim: true },
      minRP: { type: Number, required: true, min: 0, max: 10000 },
      tenureMonths: { type: Number, required: true, min: 0, max: 120 },
      enabled: { type: Boolean, default: true },
      updatedBy: ref("User", false),
    },
    options,
  ),
);
