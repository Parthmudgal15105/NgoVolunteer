import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { validateEnvironment } from "../server/config/environment.js";
import { databaseManifest } from "../scripts/database-manifest.js";

process.env.NODE_ENV = "production";
process.env.CLIENT_ORIGIN = "https://ngo.example.org";
process.env.TRUST_PROXY = "1";
process.env.JWT_SECRET = "deployment-tests-only-unique-secret-32-characters";
const { default: app } = await import("../server/app.js");
let mongo, server, base;
before(async () => {
  mongo = await MongoMemoryServer.create();
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongo.stop();
});

test("production requires secrets, TLS and an exact HTTPS frontend origin", () => {
  const env = {
    NODE_ENV: "production",
    JWT_SECRET: "x".repeat(48),
    MONGODB_URI: "mongodb+srv://cluster.example.org/wwc_real",
    CLIENT_ORIGIN: "https://ngo.example.org",
    TRUST_PROXY: "1",
  };
  assert.doesNotThrow(() => validateEnvironment(env));
  for (const change of [
    { MONGODB_URI: "" },
    { JWT_SECRET: "short" },
    { MONGODB_URI: "mongodb://localhost/wwc_real" },
    { MONGODB_URI: env.MONGODB_URI + "?tls=false" },
    { CLIENT_ORIGIN: "http://localhost:5173" },
    { CLIENT_ORIGIN: "https://ngo.example.org/" },
    { TRUST_PROXY: "true" },
  ]) {
    assert.throws(() => validateEnvironment({ ...env, ...change }));
  }
});

test("production health, CORS preflight, proxy rate limiting and safe errors", async () => {
  assert.equal((await fetch(base + "/health")).status, 503);
  await mongoose.connect(mongo.getUri("deployment"));
  const health = await fetch(base + "/health");
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("cache-control"), "no-store");
  assert.deepEqual(await health.json(), {
    status: "ok",
    database: "connected",
  });
  const preflight = await fetch(base + "/profile", {
    method: "OPTIONS",
    headers: {
      Origin: process.env.CLIENT_ORIGIN,
      "Access-Control-Request-Method": "PUT",
      "Access-Control-Request-Headers": "authorization,content-type",
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(
    preflight.headers.get("access-control-allow-origin"),
    process.env.CLIENT_ORIGIN,
  );
  assert.match(
    preflight.headers.get("access-control-allow-headers"),
    /authorization/,
  );
  const untrusted = await fetch(base + "/health", {
    headers: { Origin: "https://outside.example.org" },
  });
  assert.notEqual(
    untrusted.headers.get("access-control-allow-origin"),
    "https://outside.example.org",
  );
  const invalid = await fetch(base + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), { message: "Invalid request body." });
  assert.equal(app.get("trust proxy"), 1);
  // A proxy must not collapse every user's login allowance into one shared IP.
  for (let i = 0; i < 101; i++) {
    const response = await fetch(base + "/auth/me", {
      headers: { "X-Forwarded-For": "192.0.2.1" },
    });
    assert.equal(response.status, i < 100 ? 401 : 429);
  }
  assert.equal(
    (
      await fetch(base + "/auth/me", {
        headers: { "X-Forwarded-For": "192.0.2.2" },
      })
    ).status,
    401,
  );
  const { seed } = await import("../server/seed.js");
  await assert.rejects(seed(), /disabled in production/);
});

test("migration verifier detects password, role and binary archive changes without writes", async () => {
  // App models build indexes asynchronously; finish setup before comparing snapshots.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  const db = mongoose.connection.db;
  const id = new mongoose.Types.ObjectId();
  await db
    .collection("users")
    .insertOne({
      _id: id,
      password: "bcrypt-hash",
      role: "head",
      departments: ["Research"],
    });
  await db
    .collection("source_workbooks")
    .insertOne({ contents: Buffer.from([0, 1, 255]) });
  const uri = mongo.getUri("deployment");
  const baseline = await databaseManifest(uri);
  assert.deepEqual(await databaseManifest(uri), baseline);
  for (const field of [
    { password: "changed" },
    { role: "admin" },
    { departments: ["Operations"] },
  ]) {
    await db.collection("users").updateOne({ _id: id }, { $set: field });
    assert.notDeepEqual(await databaseManifest(uri), baseline);
    await db
      .collection("users")
      .updateOne(
        { _id: id },
        {
          $set: {
            password: "bcrypt-hash",
            role: "head",
            departments: ["Research"],
          },
        },
      );
  }
  await db
    .collection("source_workbooks")
    .updateOne({}, { $set: { contents: Buffer.from([1, 2, 3]) } });
  assert.notDeepEqual(await databaseManifest(uri), baseline);
  assert.equal(await db.collection("users").countDocuments(), 1);
});
