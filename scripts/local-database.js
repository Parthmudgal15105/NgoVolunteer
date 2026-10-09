import { MongoMemoryServer } from "mongodb-memory-server";
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
const root = path.resolve(import.meta.dirname, "..");
export async function localDatabase() {
  const dbPath = path.join(root, ".data/mongodb");
  await fs.mkdir(dbPath, { recursive: true, mode: 0o700 });
  await fs.mkdir(path.join(root, "private"), { recursive: true, mode: 0o700 });
  const secretPath = path.join(root, "private/jwt-secret");
  try {
    await fs.writeFile(secretPath, randomBytes(48).toString("hex"), {
      flag: "wx",
      mode: 0o600,
    });
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
  }
  process.env.JWT_SECRET = (await fs.readFile(secretPath, "utf8")).trim();
  const mongo = await MongoMemoryServer.create({
    instance: {
      dbPath,
      storageEngine: "wiredTiger",
      dbName: "wwc_real",
      ip: "127.0.0.1",
      port: 27018,
    },
  });
  return { mongo, uri: mongo.getUri("wwc_real") };
}
