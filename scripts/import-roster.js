// Uses the current DATABASE 2026 roster for accounts; other tabs stay as source records.
// Re-running never resets passwords. Private exports are owner-readable only.
import fs from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { localDatabase } from "./local-database.js";
import { User, VolunteerProfile, SourceRow } from "../server/models/index.js";
const source = JSON.parse(
  await fs.readFile("private/imports/source.json", "utf8"),
);
const clean = (value) => String(value ?? "").trim();
const nameKey = (value) => clean(value).toLowerCase().replace(/\s+/g, " ");
const people = [];
const issues = [];
for (const r of source.roster) {
  const [name, phone, email, department, state, joined, orgRole] = r.cells;
  if (!phone && !email && !department) continue; // section divider, not a person
  const existing = people.find(
    (p) =>
      p.email === clean(email).toLowerCase() &&
      nameKey(p.name) === nameKey(name),
  );
  if (existing) {
    existing.departments = [
      ...new Set([...existing.departments, clean(department)].filter(Boolean)),
    ];
    existing.sourceRows.push(r.row);
    issues.push({
      row: r.row,
      name: clean(name),
      note: "Duplicate person merged; both department memberships retained.",
    });
    continue;
  }
  const index = people.length;
  people.push({
    name: clean(name),
    email: clean(email).toLowerCase(),
    phone: clean(phone),
    departments: clean(department) ? [clean(department)] : [],
    state: clean(state),
    joiningDate: clean(joined),
    organizationRole: clean(orgRole),
    sourceRows: [r.row],
    loginId: `wwc-${String(r.row).padStart(4, "0")}`,
    role: index < 7 ? "admin" : orgRole === "Core Team" ? "head" : "volunteer",
    founder: index < 4,
  });
}
for (const p of people) {
  if (!/^\S+@\S+\.\S+$/.test(p.email))
    issues.push({
      row: p.sourceRows[0],
      name: p.name,
      note: "Email is invalid in source; use Login ID until corrected.",
    });
  if (people.filter((o) => o.email === p.email).length > 1)
    issues.push({
      row: p.sourceRows[0],
      name: p.name,
      note: "Email is shared by different names; use the separate Login ID.",
    });
  if (!p.departments.length)
    issues.push({
      row: p.sourceRows[0],
      name: p.name,
      note: "Department missing in source; no department head can access this person until assigned.",
    });
}
const summary = {
  accounts: people.length,
  founders: people.filter((p) => p.founder).length,
  fullAccess: people.filter((p) => p.role === "admin").length,
  heads: people.filter((p) => p.role === "head").length,
  volunteers: people.filter((p) => p.role === "volunteer").length,
  sourceRows: source.sourceRows.length,
  sourceSheets: new Set(source.sourceRows.map((r) => r.sheet)).size,
  reviewItems: issues.length,
};
if (!process.argv.includes("--apply")) {
  console.log(JSON.stringify(summary));
  await fs.writeFile(
    "private/imports/import-review.json",
    JSON.stringify({ summary, issues }, null, 2),
    { mode: 0o600 },
  );
  process.exit(0);
}
const { mongo, uri } = await localDatabase();
try {
  await mongoose.connect(uri);
  await Promise.all([User.init(), VolunteerProfile.init(), SourceRow.init()]);
  const others = await User.countDocuments({ loginId: { $exists: false } });
  if (others)
    throw new Error(
      "This database contains non-imported users. Import stopped to avoid mixing data.",
    );
  let credentials = [];
  try {
    credentials = JSON.parse(
      await fs.readFile("private/imports/credentials.json", "utf8"),
    );
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  // Verify the recovery export before any mutation; never re-use a stale export.
  for (const p of people) {
    const saved = await User.findOne({ loginId: p.loginId }).select(
      "+password",
    );
    if (saved) {
      const credential = credentials.find((c) => c.loginId === p.loginId);
      if (
        !credential ||
        !(await bcrypt.compare(credential.password, saved.password))
      )
        throw new Error(
          "Existing account password differs from private export. Import stopped; credentials were not reset.",
        );
    }
  }
  for (const p of people) {
    let user = await User.findOne({ loginId: p.loginId });
    let credential = credentials.find((c) => c.loginId === p.loginId);
    if (!user) {
      credential = {
        ...p,
        password: randomBytes(15).toString("base64url") + "!7aA",
      };
      credentials.push(credential);
      // Journal the generated password first so a stopped import can resume safely.
      await fs.writeFile(
        "private/imports/credentials.json",
        JSON.stringify(credentials, null, 2),
        { mode: 0o600 },
      );
      user = await User.create({
        ...p,
        active: true,
        password: await bcrypt.hash(credential.password, 12),
      });
    } else {
      Object.assign(user, p);
      await user.save();
      Object.assign(credential, p);
    }
    await VolunteerProfile.findOneAndUpdate(
      { user: user._id },
      { phone: p.phone, state: p.state, joiningDate: p.joiningDate },
      { upsert: true },
    );
  }
  const contents = await fs.readFile("private/imports/ngo-source.xlsx");
  const sourceHash = createHash("sha256").update(contents).digest("hex");
  await mongoose.connection
    .collection("source_workbooks")
    .updateOne(
      { sourceHash },
      { $setOnInsert: { sourceHash, contents, importedAt: new Date() } },
      { upsert: true },
    );
  await SourceRow.bulkWrite(
    source.sourceRows.map((r) => ({
      updateOne: {
        filter: { sheet: r.sheet, row: r.row },
        update: { $set: r },
        upsert: true,
      },
    })),
  );
  await fs.writeFile(
    "private/imports/credentials.json",
    JSON.stringify(credentials, null, 2),
    { mode: 0o600 },
  );
  await fs.writeFile(
    "private/imports/import-review.json",
    JSON.stringify(
      {
        summary,
        issues,
        sourceHash: createHash("sha256")
          .update(await fs.readFile("private/imports/ngo-source.xlsx"))
          .digest("hex"),
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      ...summary,
      imported: await User.countDocuments(),
      passwordsVerified: credentials.length,
    }),
  );
} finally {
  await mongoose.disconnect();
  await mongo.stop({ doCleanup: false });
}
