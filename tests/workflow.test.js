import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
process.env.JWT_SECRET = "integration-test-secret-at-least-32-characters";
const { default: app } = await import("../server/app.js");
const { User, Event, Attendance, Certificate } =
  await import("../server/models/index.js");
let mongo, server, base, admin, volunteer, other, eventId, registrationId;
async function request(path, { method = "GET", body, token } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = response.headers
    .get("content-type")
    ?.includes("application/json")
    ? await response.json()
    : Buffer.from(await response.arrayBuffer());
  return { status: response.status, data };
}
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
  await User.create({
    name: "Test Admin",
    email: "admin@test.org",
    password: await bcrypt.hash("Password123", 10),
    role: "admin",
  });
  admin = (
    await request("/auth/login", {
      method: "POST",
      body: { email: "admin@test.org", password: "Password123" },
    })
  ).data.token;
});
after(async () => {
  await new Promise((resolve) => server?.close(resolve));
  await mongoose.disconnect();
  await mongo?.stop();
});
test("complete registration, approval, attendance, and certificate workflow", async () => {
  let r = await request("/auth/register", {
    method: "POST",
    body: {
      name: "Maya Test",
      email: "maya@test.org",
      password: "Password123",
      role: "admin",
      phone: "9876543210",
      interest: "Education",
    },
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.user.role, "volunteer");
  volunteer = r.data.token;
  const userId = r.data.user._id;
  const profile = await request("/profile", { token: volunteer });
  assert.equal(profile.data.phone, "9876543210");
  assert.deepEqual(profile.data.interests, ["Education"]);
  r = await request("/auth/login", {
    method: "POST",
    body: { email: "maya@test.org", password: "Password123" },
  });
  assert.equal(r.status, 200);
  r = await request("/events", { method: "POST", token: volunteer, body: {} });
  assert.equal(r.status, 403);
  const event = {
    title: "Integration cleanup",
    description: "Clean our local park",
    category: "Environment",
    location: "Mumbai",
    date: new Date(Date.now() + 86400000).toISOString(),
    hours: 4,
    capacity: 1,
  };
  r = await request("/events", { method: "POST", token: admin, body: event });
  assert.equal(r.status, 201);
  eventId = r.data._id;
  r = await request(`/events/${eventId}/apply`, {
    method: "POST",
    token: volunteer,
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.status, "pending");
  registrationId = r.data._id;
  r = await request(`/events/${eventId}/apply`, {
    method: "POST",
    token: volunteer,
  });
  assert.equal(r.status, 409);
  r = await request("/attendance", {
    method: "PUT",
    token: admin,
    body: { event: eventId, volunteer: userId, status: "present" },
  });
  assert.equal(r.status, 400);
  r = await request(`/registrations/${registrationId}`, {
    method: "PATCH",
    token: admin,
    body: { status: "approved" },
  });
  assert.equal(r.status, 200);
  r = await request("/auth/register", {
    method: "POST",
    body: {
      name: "Other User",
      email: "other@test.org",
      password: "Password123",
    },
  });
  other = r.data.token;
  r = await request(`/events/${eventId}/apply`, {
    method: "POST",
    token: other,
  });
  assert.equal(r.status, 400);
  r = await request("/notifications", { token: volunteer });
  assert.match(r.data[0].message, /approved/);
  await Event.findByIdAndUpdate(eventId, {
    date: new Date(Date.now() - 86400000),
  });
  for (let i = 0; i < 2; i++) {
    r = await request("/attendance", {
      method: "PUT",
      token: admin,
      body: { event: eventId, volunteer: userId, status: "present" },
    });
    assert.equal(r.status, 200);
  }
  assert.equal(await Attendance.countDocuments(), 1);
  r = await request("/dashboard", { token: volunteer });
  assert.equal(r.data.hours, 4);
  assert.equal(r.data.participated, 1);
  r = await request("/certificates", { token: volunteer });
  assert.equal(r.data.length, 0);
  for (let i = 0; i < 2; i++) {
    r = await request(`/events/${eventId}/complete`, {
      method: "POST",
      token: admin,
    });
    assert.equal(r.status, 200);
  }
  assert.equal(await Certificate.countDocuments(), 1);
  r = await request("/certificates", { token: volunteer });
  const certId = r.data[0]._id;
  r = await request(`/certificates/${certId}/download`, { token: volunteer });
  assert.equal(r.status, 200);
  assert.equal(r.data.subarray(0, 4).toString(), "%PDF");
  r = await request(`/certificates/${certId}/download`, { token: other });
  assert.equal(r.status, 403);
  r = await request("/dashboard", { token: admin });
  assert.equal(r.data.hours, 4);
  assert.equal(r.data.certificates, 1);
  assert.equal(r.data.completed, 1);
  r = await request("/attendance", {
    method: "PUT",
    token: admin,
    body: { event: eventId, volunteer: userId, status: "absent" },
  });
  assert.equal(r.status, 200);
  assert.equal(await Certificate.countDocuments(), 0);
  r = await request("/dashboard", { token: volunteer });
  assert.equal(r.data.hours, 0);
  r = await request("/events/invalid/apply", {
    method: "POST",
    token: volunteer,
  });
  assert.equal(r.status, 400);
  r = await request("/volunteers", { token: volunteer });
  assert.equal(r.status, 403);
  r = await request("/registrations");
  assert.equal(r.status, 401);
});
test("concurrent approvals cannot exceed capacity", async () => {
  const user = await User.findOne({ email: "maya@test.org" });
  const otherUser = await User.findOne({ email: "other@test.org" });
  const r = await request("/events", {
    method: "POST",
    token: admin,
    body: {
      title: "One place",
      description: "Capacity test",
      category: "Community",
      location: "Mumbai",
      date: new Date(Date.now() + 86400000).toISOString(),
      hours: 2,
      capacity: 1,
    },
  });
  const id = r.data._id;
  const first = await request(`/events/${id}/apply`, {
    method: "POST",
    token: volunteer,
  });
  const second = await request(`/events/${id}/apply`, {
    method: "POST",
    token: other,
  });
  const results = await Promise.all(
    [first, second].map((x) =>
      request(`/registrations/${x.data._id}`, {
        method: "PATCH",
        token: admin,
        body: { status: "approved" },
      }),
    ),
  );
  assert.deepEqual(results.map((x) => x.status).sort(), [200, 400]);
});
