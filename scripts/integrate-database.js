// Source extraction is private; repeat imports preserve credentials and attendance corrections.
import fs from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { localDatabase } from "./local-database.js";
import {
  User,
  VolunteerProfile,
  SourceRow,
  Contribution,
} from "../server/models/index.js";
const input = JSON.parse(
  await fs.readFile("private/imports/integration.json", "utf8"),
);
const sourceDirectory = process.env.NGO_SOURCE_DIR || "private/source-files";
const key = (v) =>
  String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
const apply = process.argv.includes("--apply");
const { mongo, uri } = await localDatabase();
const review = [];
const summary = {
  credentialsVerified: 0,
  rosterMatched: 0,
  newMembers: 0,
  participationMatched: 0,
  participationUnresolved: 0,
};
try {
  await mongoose.connect(uri);
  await Promise.all([
    User.init(),
    VolunteerProfile.init(),
    SourceRow.init(),
    Contribution.init(),
  ]);
  const users = await User.find().select("+password");
  const journal = JSON.parse(
    await fs.readFile("private/imports/credentials.json", "utf8"),
  );
  for (const c of input.credentials) {
    const u = users.find((u) => u.loginId === c.loginId);
    if (
      !u ||
      key(u.name) !== key(c.name) ||
      key(u.email) !== key(c.email) ||
      !(await bcrypt.compare(c.password, u.password))
    )
      throw new Error(
        "Credential verification failed. No passwords were changed.",
      );
    summary.credentialsVerified++;
  }
  for (const [i, cells] of input.pdfRoster.entries()) {
    const [
      name,
      phone,
      email,
      department,
      state,
      joiningDate,
      organizationRole,
    ] = cells;
    if (cells.length < 6 || !email?.includes("@") || !/[a-z]/i.test(name)) {
      review.push({
        source: "Final roster PDF",
        row: i + 1,
        reason: "Incomplete identity; retained as source only.",
      });
      continue;
    }
    let u = users.find(
      (u) => key(u.name) === key(name) && key(u.email) === key(email),
    );
    if (!u) {
      const collisions = users.filter(
        (u) => key(u.name) === key(name) || key(u.email) === key(email),
      );
      if (collisions.length) {
        review.push({
          source: "Final roster PDF",
          row: i + 1,
          reason: "Identity conflicts with an existing member.",
        });
        continue;
      }
      const loginId = `wwc-pdf-${String(i + 1).padStart(4, "0")}`;
      const password = randomBytes(18).toString("base64url") + "!7aA";
      const data = {
        name,
        email: key(email),
        loginId,
        departments: [department],
        organizationRole,
        role: "volunteer",
        active: true,
      };
      summary.newMembers++;
      if (!apply) continue;
      journal.push({ ...data, password, phone, state, joiningDate });
      await fs.writeFile(
        "private/imports/credentials.json",
        JSON.stringify(journal, null, 2),
        { mode: 0o600 },
      );
      u = await User.create({
        ...data,
        password: await bcrypt.hash(password, 12),
      });
      users.push(u);
    } else {
      summary.rosterMatched++;
      if (apply) {
        if (organizationRole) u.organizationRole = organizationRole;
        // Preserve multiple departments already recorded for a member.
        u.departments = [
          ...new Set([...u.departments, department].filter(Boolean)),
        ];
        await u.save();
      }
    }
    if (apply)
      await VolunteerProfile.findOneAndUpdate(
        { user: u._id },
        { phone, state, joiningDate },
        { upsert: true },
      );
  }
  const seen = new Set();
  for (const p of input.participation) {
    const matches = users.filter((u) => key(u.name) === key(p.name));
    const c = p.context;
    const parts = c?.date.split("/").map(Number);
    const date = parts
      ? new Date(
          Date.UTC(
            parts[2] < 100 ? 2000 + parts[2] : parts[2],
            parts[1] - 1,
            parts[0],
          ),
        )
      : null;
    const validDate =
      date &&
      date.getUTCDate() === parts[0] &&
      date.getUTCMonth() === parts[1] - 1;
    const identity = `${matches[0]?._id}:${date?.toISOString()}:${key(c?.location)}:${key(c?.title)}`;
    if (matches.length !== 1 || !validDate || !c.title || seen.has(identity)) {
      summary.participationUnresolved++;
      review.push({
        source: p.sourceKey,
        reason:
          matches.length !== 1
            ? "No unique exact member match."
            : "Missing drive details or duplicate participation.",
      });
      continue;
    }
    seen.add(identity);
    summary.participationMatched++;
    if (apply)
      await Contribution.updateOne(
        { sourceKey: p.sourceKey },
        {
          $setOnInsert: {
            volunteer: matches[0]._id,
            title: c.title,
            kind: "drive",
            date,
            status: p.status,
            hours: p.status === "absent" ? 0 : null,
            location: c.location,
            sourceDepartment: p.department,
            notes: [
              p.remarks,
              p.defaults ? `Source defaults: ${p.defaults}` : "",
              c.responsibleHead ? `Responsible head: ${c.responsibleHead}` : "",
            ]
              .filter(Boolean)
              .join(". "),
            sourceKey: p.sourceKey,
          },
        },
        { upsert: true, runValidators: true },
      );
  }
  if (apply) {
    await SourceRow.bulkWrite(
      input.sources.map((r) => ({
        updateOne: {
          filter: { sheet: r.sheet, row: r.row },
          update: { $set: r },
          upsert: true,
        },
      })),
    );
    for (const filename of [
      "Database 2026 - DATABASE 2026.pdf",
      "2026 Drive List Database.ods",
      "Certificate and department change (Responses).ods",
    ]) {
      const contents = await fs.readFile(
        `${sourceDirectory}/${filename}`,
      );
      const sourceHash = createHash("sha256").update(contents).digest("hex");
      await mongoose.connection
        .collection("source_workbooks")
        .updateOne(
          { sourceHash },
          {
            $setOnInsert: {
              sourceHash,
              filename,
              contents,
              importedAt: new Date(),
            },
          },
          { upsert: true },
        );
    }
  }
  summary.requestRowsArchived = input.sources.filter((r) =>
    r.sheet.startsWith("Requests / "),
  ).length;
  summary.totalAccounts = await User.countDocuments();
  summary.storedContributions = await Contribution.countDocuments();
  await fs.writeFile(
    "private/imports/integration-review.json",
    JSON.stringify({ applied: apply, summary, review }, null, 2),
    { mode: 0o600 },
  );
  console.log(JSON.stringify({ applied: apply, ...summary }));
} finally {
  await mongoose.disconnect();
  await mongo.stop({ doCleanup: false });
}
