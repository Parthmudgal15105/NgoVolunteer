import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import {
  User,
  VolunteerProfile,
  Event,
  EventRegistration,
  Contribution,
  ProgramCertificate,
} from "../server/models/index.js";
import { parseJoiningDate } from "../server/utils/programCertificates.js";
process.env.JWT_SECRET = "feature-integration-secret-at-least-32-chars";
const { default: app } = await import("../server/app.js");
let mongo, server, base;
const password = "UniquePassword123!";
async function req(path, token, body, method = body ? "POST" : "GET") {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: r.status,
    body: r.headers.get("content-type")?.includes("json")
      ? await r.json()
      : await r.arrayBuffer(),
  };
}
let hash;
async function member(name, role, departments, extra = {}) {
  hash ||= await bcrypt.hash(password, 10);
  return User.create({
    name,
    email: `${name}@test.org`,
    loginId: name,
    password: hash,
    role,
    departments,
    ...extra,
  });
}
const login = async (u) =>
  (await req("/auth/login", "", { email: u.loginId, password })).body.token;
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  await new Promise((r) => server.close(r));
  await mongoose.disconnect();
  await mongo.stop();
});

test("joining dates parse from the roster's DD/MM/YYYY format", () => {
  assert.equal(
    parseJoiningDate("12/6/2026").toISOString(),
    "2026-06-11T18:30:00.000Z",
  );
  assert.equal(parseJoiningDate("31/02/2026"), null);
  assert.equal(parseJoiningDate(""), null);
});

test("Operations heads and admins manage events; other heads cannot", async () => {
  const admin = await member("bod", "admin", ["BOD"]);
  const ops = await member("opshead", "head", ["Operations"]);
  const research = await member("researchhead", "head", ["Research"]);
  const event = {
    title: "Tree plantation",
    description: "Plant saplings",
    category: "Environment",
    location: "Park",
    date: new Date(Date.now() + 86400000).toISOString(),
    hours: 2,
    capacity: 10,
    rp: 8,
  };
  const opsToken = await login(ops);
  const created = await req("/events", opsToken, event);
  assert.equal(created.status, 201);
  assert.equal(created.body.rp, 8);
  assert.equal(
    (await req("/events", await login(research), event)).status,
    403,
  );
  assert.equal((await req("/events", await login(admin), event)).status, 201);
  const me = await req("/auth/me", opsToken);
  assert.equal(me.body.permissions.manageEvents, true);
  assert.equal(me.body.permissions.announcements, false);
});

test("heads add volunteers only to their own departments; HR sees everyone", async () => {
  const head = await member("finhead", "head", ["Finance"]);
  const hr = await member("hrhead", "head", ["Human Resource"]);
  const other = await member("outsider", "volunteer", ["Marketing"]);
  const ht = await login(head);
  const added = await req("/volunteers", ht, {
    name: "New Person",
    email: "new.person@test.org",
    departments: ["Finance"],
    phone: "123",
    role: "admin",
  });
  assert.equal(added.status, 201);
  assert.ok(added.body.temporaryPassword.length >= 12);
  const created = await User.findById(added.body.user._id);
  assert.equal(created.role, "volunteer");
  assert.deepEqual(created.departments, ["Finance"]);
  const loginNew = await req("/auth/login", "", {
    email: "new.person@test.org",
    password: added.body.temporaryPassword,
  });
  assert.equal(loginNew.status, 200);
  assert.equal(
    (
      await req("/volunteers", ht, {
        name: "Wrong Dept",
        email: "wrong@test.org",
        departments: ["Marketing"],
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await req("/volunteers", ht, {
        name: "Dup",
        email: "new.person@test.org",
        departments: ["Finance"],
      })
    ).status,
    409,
  );
  const hrList = (await req("/volunteers", await login(hr))).body;
  assert.ok(hrList.some((v) => String(v._id) === String(other._id)));
  assert.ok(!hrList.some((v) => v.role !== "volunteer"));
  const headList = (await req("/volunteers", ht)).body;
  assert.ok(!headList.some((v) => String(v._id) === String(other._id)));
  assert.equal((await req(`/volunteers/${other._id}/report`, ht)).status, 403);
});

test("heads choose RP per activity while legacy records keep their RP", async () => {
  const head = await member("researchlead", "head", ["Research"]);
  const vol = await member("researcher", "volunteer", ["Research"]);
  const ht = await login(head);
  const legacy = await Contribution.create({
    volunteer: vol._id,
    title: "Old drive",
    kind: "drive",
    date: new Date(Date.now() - 86400000 * 40),
    status: "present",
  });
  assert.equal(
    (
      await req("/rp-rules", ht, {
        department: "Operations",
        label: "Nope",
        points: 4,
      })
    ).status,
    403,
  );
  const rule = await req("/rp-rules", ht, {
    department: "Research",
    label: "Research paper",
    points: 7,
  });
  assert.equal(rule.status, 201);
  const fromRule = await req("/contributions", ht, {
    volunteer: vol._id,
    title: "Paper on water access",
    date: new Date(Date.now() - 86400000).toISOString(),
    status: "present",
    rule: rule.body._id,
  });
  assert.equal(fromRule.status, 201);
  assert.equal(fromRule.body.points, 7);
  assert.equal(fromRule.body.ruleLabel, "Research paper");
  const custom = await req("/contributions", ht, {
    volunteer: vol._id,
    title: "Survey",
    date: new Date(Date.now() - 86400000).toISOString(),
    status: "present",
    kind: "custom",
    points: 3,
    ruleLabel: "Field survey",
  });
  assert.equal(custom.status, 201);
  const missingPoints = await req("/contributions", ht, {
    volunteer: vol._id,
    title: "Survey",
    date: new Date(Date.now() - 86400000).toISOString(),
    status: "present",
    kind: "custom",
  });
  assert.equal(missingPoints.status, 400);
  const list = (await req("/contributions", ht)).body;
  assert.equal(list.find((r) => String(r._id) === String(legacy._id)).rp, 5);
  const v = (await req("/volunteers", ht)).body.find(
    (x) => String(x._id) === String(vol._id),
  );
  assert.equal(v.rp, 5 + 7 + 3);
  const report = await req(`/volunteers/${vol._id}/report`, ht);
  assert.equal(report.status, 200);
  assert.equal(report.body.totals.rp, 15);
  assert.ok(report.body.byActivity.some((a) => a.label === "Research paper"));
  assert.equal(
    (await req(`/volunteers/${vol._id}/report`, await login(vol))).status,
    200,
  );
  const month = new Date(Date.now() - 86400000 + 5.5 * 3600000)
    .toISOString()
    .slice(0, 7);
  const monthly = await req(`/reports/monthly?month=${month}`, ht);
  assert.equal(monthly.status, 200);
  const row = monthly.body.members.find(
    (m) => String(m._id) === String(vol._id),
  );
  assert.equal(row.activities, 2);
  assert.equal(row.level, "Active");
  assert.deepEqual(
    monthly.body.departments.map((d) => d.name),
    ["Research"],
  );
  assert.equal((await req("/reports/monthly", await login(vol))).status, 403);
});

test("tenure certificates issue only after the tenure and minimum RP", async () => {
  const head = await member("prhead", "head", ["Public Relations"]);
  const other = await member("mkthead", "head", ["Marketing"]);
  const vol = await member("prvol", "volunteer", ["Public Relations"]);
  await VolunteerProfile.create({ user: vol._id, joiningDate: "01/01/2026" });
  const ht = await login(head);
  const vt = await login(vol);
  assert.equal(
    (
      await req(
        "/certificate-rules",
        await login(other),
        { department: "Public Relations", minRP: 1, tenureMonths: 1 },
        "PUT",
      )
    ).status,
    403,
  );
  const rule = await req(
    "/certificate-rules",
    ht,
    { department: "Public Relations", minRP: 10, tenureMonths: 2 },
    "PUT",
  );
  assert.equal(rule.status, 200);
  // Joined long enough ago, but no RP yet.
  assert.equal((await req("/program-certificates", vt)).body.length, 0);
  let status = (await req("/certificate-status", ht)).body.find(
    (s) => String(s.volunteer._id) === String(vol._id),
  );
  assert.equal(status.eligible, false);
  assert.match(status.reason, /10 more RP/);
  await req("/contributions", ht, {
    volunteer: vol._id,
    title: "Media outreach",
    date: new Date(Date.now() - 86400000).toISOString(),
    status: "present",
    kind: "custom",
    points: 6,
  });
  assert.equal(await ProgramCertificate.countDocuments(), 0);
  // A head marks a fresh tenure that has not finished: still nothing.
  await req(
    `/volunteers/${vol._id}/tenure`,
    ht,
    { start: new Date(Date.now() - 86400000 * 10).toISOString(), months: 3 },
    "PUT",
  );
  await req("/contributions", ht, {
    volunteer: vol._id,
    title: "Press release",
    date: new Date(Date.now() - 86400000).toISOString(),
    status: "present",
    kind: "custom",
    points: 6,
  });
  assert.equal(await ProgramCertificate.countDocuments(), 0);
  // Back to the roster joining date: tenure is over and 12 RP ≥ 10.
  await req(`/volunteers/${vol._id}/tenure`, ht, { minRP: 12 }, "PUT");
  const certs = (await req("/program-certificates", vt)).body;
  assert.equal(certs.length, 1);
  assert.equal(certs[0].kind, "tenure");
  assert.equal(certs[0].rp, 12);
  assert.equal(certs[0].department, "Public Relations");
  await req("/program-certificates", vt); // repeat reads do not duplicate
  assert.equal(await ProgramCertificate.countDocuments(), 1);
  const pdf = await req(`/program-certificates/${certs[0]._id}/download`, vt);
  assert.equal(pdf.status, 200);
  assert.ok(Buffer.from(pdf.body).subarray(0, 4).toString() === "%PDF");
  // Volunteers cannot edit; heads can, and the edit sticks.
  assert.equal(
    (
      await req(
        `/program-certificates/${certs[0]._id}`,
        vt,
        { title: "Hacked" },
        "PATCH",
      )
    ).status,
    403,
  );
  const edited = await req(
    `/program-certificates/${certs[0]._id}`,
    ht,
    { title: "Volunteer Tenure", displayName: "P. R. Volunteer" },
    "PATCH",
  );
  assert.equal(edited.body.displayName, "P. R. Volunteer");
  assert.equal(
    (
      await req(
        `/program-certificates/${certs[0]._id}`,
        await login(other),
        { title: "x" },
        "PATCH",
      )
    ).status,
    403,
  );
  // Heads issue a manual certificate like "Volunteer of the Month".
  const manual = await req("/program-certificates", ht, {
    volunteer: vol._id,
    title: "Volunteer of the Month",
    period: "February 2026",
  });
  assert.equal(manual.status, 201);
  assert.equal(manual.body.kind, "manual");
  // Volunteers cannot issue; heads can withdraw what they issued.
  assert.equal(
    (
      await req("/program-certificates", vt, {
        volunteer: vol._id,
        title: "Self award",
      })
    ).status,
    403,
  );
  assert.equal(
    (await req(`/program-certificates/${manual.body._id}`, ht, null, "DELETE"))
      .status,
    200,
  );
});

test("event certificate edits survive later attendance saves", async () => {
  const admin = await member("founder2", "admin", ["BOT"]);
  const vol = await member("eventvol", "volunteer", ["Operations"]);
  const at = await login(admin);
  const event = await Event.create({
    title: "Food drive",
    description: "Pack meals",
    category: "Community",
    location: "Hall",
    date: new Date(Date.now() - 3600000),
    hours: 3,
    capacity: 5,
    rp: 9,
    status: "completed",
    createdBy: admin._id,
  });
  await EventRegistration.create({
    event: event._id,
    volunteer: vol._id,
    status: "approved",
  });
  const put = (status) =>
    req(
      "/attendance",
      at,
      { event: event._id, volunteer: vol._id, status },
      "PUT",
    );
  await put("present");
  const [cert] = (await req("/certificates", at)).body;
  const edit = await req(
    `/certificates/${cert._id}`,
    at,
    { displayName: "Correct Name", overrideHours: 4 },
    "PATCH",
  );
  assert.equal(edit.status, 200);
  await put("present");
  const [after] = (await req("/certificates", at)).body;
  assert.equal(after.displayName, "Correct Name");
  assert.equal(after.overrideHours, 4);
  const attendance = (await req("/attendance", at)).body.find(
    (a) => String(a.volunteer._id) === String(vol._id),
  );
  assert.equal(attendance.rp, 9);
  assert.equal(
    (
      await req(
        `/certificates/${cert._id}`,
        await login(vol),
        { displayName: "x" },
        "PATCH",
      )
    ).status,
    403,
  );
});

test("certificate wording can be changed by heads, not volunteers", async () => {
  const head = await member("mkt2", "head", ["Marketing"]);
  const vol = await member("mktvol", "volunteer", ["Marketing"]);
  const body = {
    heading: "CERTIFICATE",
    manualBody: "from **{department} Department** for being **{title}**.",
  };
  assert.equal(
    (await req("/certificate-template", await login(vol), body, "PUT")).status,
    403,
  );
  const saved = await req(
    "/certificate-template",
    await login(head),
    body,
    "PUT",
  );
  assert.equal(saved.status, 200);
  assert.equal(saved.body.template.manualBody, body.manualBody);
  assert.ok(saved.body.template.tenureBody.length > 10);
  const preview = await req(
    "/certificate-template/preview",
    await login(head),
    body,
  );
  assert.equal(preview.status, 200);
});
