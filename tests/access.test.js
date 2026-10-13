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
  Attendance,
  Certificate,
  SourceRow,
  Contribution,
} from "../server/models/index.js";
process.env.JWT_SECRET = "department-access-integration-secret-at-least-32";
const { default: app } = await import("../server/app.js");
let mongo, server, base;
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
test("department heads cannot read or change another department, including direct record IDs", async () => {
  const password = "UniquePassword123!";
  const hash = await bcrypt.hash(password, 10);
  const make = (name, role, departments, email = name + "@test.org") =>
    User.create({
      name,
      email,
      loginId: name,
      password: hash,
      role,
      departments,
    });
  const admin = await make("founder", "admin", ["BOT"]);
  const head = await make("head", "head", ["Research"]);
  const own = await make("own", "volunteer", ["Research"]);
  const shared = await make("shared", "volunteer", ["Research", "Operations"]);
  const outside = await make("outside", "volunteer", ["Operations"]);
  await VolunteerProfile.create({ user: outside._id, phone: "private-phone" });
  const token = async (u) =>
    (await req("/auth/login", "", { email: u.loginId, password })).body.token;
  const ht = await token(head),
    at = await token(admin),
    vt = await token(own);
  const event = await Event.create({
    title: "Past",
    description: "Activity",
    category: "Service",
    location: "Local",
    date: new Date(Date.now() - 86400000),
    hours: 2,
    capacity: 10,
    createdBy: admin._id,
  });
  const event2 = await Event.create({
    title: "Next",
    description: "Activity",
    category: "Service",
    location: "Local",
    date: new Date(Date.now() + 86400000),
    hours: 2,
    capacity: 10,
    createdBy: admin._id,
  });
  const regs = await EventRegistration.create(
    [own, shared, outside].map((u) => ({
      event: event._id,
      volunteer: u._id,
      status: "approved",
    })),
  );
  await Attendance.create(
    [own, outside].map((u) => ({
      event: event._id,
      volunteer: u._id,
      status: "present",
      hours: 2,
      markedBy: admin._id,
    })),
  );
  const certs = await Certificate.create(
    [own, outside].map((u) => ({
      event: event._id,
      volunteer: u._id,
      certificateId: "C-" + u.name,
      hours: 2,
    })),
  );
  await SourceRow.create({
    sheet: "Private source",
    row: 1,
    cells: ["hidden"],
  });
  assert.deepEqual(
    (await req("/volunteers", ht)).body.map((u) => u.name).sort(),
    ["own", "shared"],
  );
  assert.equal((await req("/volunteers", at)).body.length, 5);
  assert.equal((await req("/volunteers", vt)).status, 403);
  for (const path of ["/registrations", "/attendance", "/certificates"]) {
    const r = await req(path, ht);
    assert.equal(r.status, 200);
    assert.ok(r.body.every((x) => x.volunteer.name !== "outside"));
  }
  assert.equal((await req("/dashboard", ht)).body.totalVolunteers, 2);
  assert.equal((await req("/dashboard", ht)).body.hours, 2);
  const contribution = await req("/contributions", ht, {
    volunteer: own._id,
    title: "Research brief",
    kind: "task",
    date: "2026-01-01",
    status: "present",
    hours: "",
    notes: "Completed research",
  });
  assert.equal(contribution.status, 201);
  assert.equal(contribution.body.hours, null);
  assert.equal(
    (
      await req("/contributions", ht, {
        volunteer: outside._id,
        title: "Outside task",
        kind: "task",
        date: "2026-01-01",
        status: "present",
        hours: 2,
      })
    ).status,
    403,
  );
  const hiddenContribution = await Contribution.create({
    volunteer: outside._id,
    title: "Outside drive",
    kind: "drive",
    date: "2026-01-01",
    status: "present",
  });
  assert.equal(
    (
      await req(
        `/contributions/${hiddenContribution._id}`,
        ht,
        { status: "absent", hours: 0 },
        "PATCH",
      )
    ).status,
    403,
  );
  assert.equal((await req("/contributions", ht)).body.length, 1);
  assert.equal((await req("/contributions", vt)).body.length, 1);
  assert.equal((await req("/contributions", at)).body.length, 2);
  assert.equal(
    (
      await req("/contributions", vt, {
        volunteer: own._id,
        title: "Self approval",
        kind: "task",
        date: "2026-01-01",
        status: "present",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await req(
        `/contributions/${contribution.body._id}`,
        ht,
        { status: "present", hours: 2, notes: "Duration confirmed" },
        "PATCH",
      )
    ).body.hours,
    2,
  );
  assert.equal(
    (
      await req(
        `/contributions/${contribution.body._id}`,
        ht,
        { status: "absent", hours: 2 },
        "PATCH",
      )
    ).body.hours,
    0,
  );
  assert.equal(
    (
      await req(
        `/contributions/${contribution.body._id}`,
        ht,
        { status: "present", hours: -1 },
        "PATCH",
      )
    ).status,
    400,
  );
  assert.equal((await req("/source-data", ht)).status, 403);
  assert.equal((await req("/source-data", at)).status, 200);
  assert.equal(
    (await req(`/volunteers/${outside._id}`, ht, { active: false }, "PATCH"))
      .status,
    403,
  );
  assert.equal(
    (await req(`/volunteers/${admin._id}`, ht, { active: false }, "PATCH"))
      .status,
    403,
  );
  assert.equal(
    (
      await req(
        `/registrations/${regs[2]._id}`,
        ht,
        { status: "rejected" },
        "PATCH",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await req("/assignments", ht, {
        event: event2._id,
        volunteer: outside._id,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await req(
        "/attendance",
        ht,
        { event: event._id, volunteer: outside._id, status: "absent" },
        "PUT",
      )
    ).status,
    403,
  );
  assert.equal(
    (await req(`/certificates/${certs[1]._id}/download`, ht)).status,
    403,
  );
  assert.equal(
    (await req(`/certificates/${certs[0]._id}/download`, ht)).status,
    200,
  );
  assert.equal(
    (await req("/events", ht, { title: "not allowed" })).status,
    403,
  );
  assert.equal(
    (await req(`/volunteers/${own._id}`, ht, { active: false }, "PATCH"))
      .status,
    200,
  );
  assert.equal((await User.findById(outside._id)).active, true);
  // Shared emails require the unique login IDs; a head cannot grant themselves full access.
  await make("collision", "volunteer", ["Research"], head.email);
  assert.equal(
    (await req("/auth/login", "", { email: head.email, password })).status,
    401,
  );
  assert.equal(
    (await req("/auth/login", "", { email: head.loginId, password })).status,
    200,
  );
  assert.equal(
    (
      await req(
        "/profile",
        ht,
        { role: "admin", departments: ["Operations"] },
        "PUT",
      )
    ).status,
    200,
  );
  assert.equal((await User.findById(head._id)).role, "head");
  assert.deepEqual((await User.findById(head._id)).departments.toObject(), [
    "Research",
  ]);
  assert.equal(
    (
      await req(
        "/auth/password",
        ht,
        { currentPassword: "wrong", newPassword: "DifferentPassword123" },
        "PUT",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await req(
        "/auth/password",
        ht,
        { currentPassword: password, newPassword: "DifferentPassword123" },
        "PUT",
      )
    ).status,
    200,
  );
  assert.equal(
    (await req("/auth/login", "", { email: head.loginId, password })).status,
    401,
  );
  assert.equal(
    (
      await req("/auth/login", "", {
        email: head.loginId,
        password: "DifferentPassword123",
      })
    ).status,
    200,
  );
});

test("heads award scoped RP, volunteers see totals, and corrections recalculate rewards", async () => {
  const password = "RewardPassword123!";
  const hash = await bcrypt.hash(password, 10);
  const make = (name, role, departments) =>
    User.create({
      name,
      email: `${name}@test.org`,
      password: hash,
      role,
      departments,
    });
  const head = await make("reward-head", "head", ["Social & Content"]);
  const member = await make("reward-member", "volunteer", ["Social & Content"]);
  const outside = await make("reward-outside", "volunteer", ["Research"]);
  const token = async (u) =>
    (await req("/auth/login", "", { email: u.email, password })).body.token;
  const ht = await token(head),
    vt = await token(member);
  const body = {
    volunteer: String(member._id),
    title: "Edited reel",
    kind: "reel_edit",
    status: "present",
    date: "2025-01-01",
    hours: "",
  };
  const reel = await req("/contributions", ht, body);
  assert.equal(reel.status, 201);
  assert.equal(
    (
      await req("/contributions", ht, {
        ...body,
        volunteer: String(outside._id),
      })
    ).status,
    403,
  );
  assert.equal((await req("/contributions", vt, body)).status, 403);
  assert.equal(
    (
      await req("/contributions", ht, {
        ...body,
        kind: "drive",
        title: "Attended drive",
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await req("/contributions", ht, {
        ...body,
        kind: "misc",
        title: "Misc action",
      })
    ).status,
    201,
  );
  assert.equal((await req("/dashboard", vt)).body.rp, 10);
  assert.equal(
    (await req("/contributions", vt)).body.reduce((n, r) => n + r.rp, 0),
    10,
  );
  assert.equal(
    (await req("/volunteers", ht)).body.find(
      (u) => u._id === String(member._id),
    ).rp,
    10,
  );
  assert.equal(
    (
      await req(
        `/contributions/${reel.body._id}`,
        ht,
        { status: "absent", hours: "" },
        "PATCH",
      )
    ).status,
    200,
  );
  assert.equal((await req("/dashboard", vt)).body.rp, 7);
  assert.equal(
    (
      await req(
        `/contributions/${reel.body._id}`,
        ht,
        { status: "present", kind: "misc", hours: "" },
        "PATCH",
      )
    ).status,
    200,
  );
  assert.equal((await req("/dashboard", vt)).body.rp, 9);
});
