// Read-only verification. Does not import application models or create indexes.
import mongoose from "mongoose";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function databaseManifest(uri) {
  const client = new mongoose.mongo.MongoClient(uri, {
    maxPoolSize: 2,
    serverSelectionTimeoutMS: 10000,
  });
  try {
    await client.connect();
    if (["test", "admin", "local", "config"].includes(client.options.dbName))
      throw new Error("An explicit application database name is required.");
    const db = client.db();
    const collections = [];
    for (const entry of (await db.listCollections().toArray()).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      if (entry.name.startsWith("system.")) continue;
      if (entry.type !== "collection")
        throw new Error("Views require a separate migration review.");
      const collection = db.collection(entry.name);
      const hash = createHash("sha256");
      let count = 0;
      // Raw BSON preserves binary workbook archives, ObjectIds, dates and numeric types.
      for await (const bson of collection
        .find({}, { raw: true })
        .sort({ _id: 1 })) {
        hash.update(bson);
        count++;
      }
      const indexes = (await collection.listIndexes().toArray()).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      collections.push({
        name: entry.name,
        count,
        sha256: hash.digest("hex"),
        indexes,
        options: entry.options,
      });
    }
    return { format: 1, collections };
  } finally {
    await client.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--compare" && args.length === 3) {
    const left = JSON.parse(await readFile(args[1], "utf8"));
    const right = JSON.parse(await readFile(args[2], "utf8"));
    if (JSON.stringify(left) !== JSON.stringify(right))
      throw new Error(
        "Database verification failed. Keep writes paused and investigate; do not cut over.",
      );
    console.log(
      "Verified: all collection counts, BSON hashes, indexes and options match.",
    );
    return;
  }
  if (args[0] !== "--uri-env" || args[2] !== "--out" || args.length !== 4)
    throw new Error(
      "Usage: node scripts/database-manifest.js --uri-env SOURCE_MONGODB_URI --out backups/source.json; or --compare source.json target.json",
    );
  const uri = process.env[args[1]];
  if (!uri)
    throw new Error("The named database URI environment variable is not set.");
  const manifest = await databaseManifest(uri);
  await mkdir(path.dirname(args[3]), { recursive: true, mode: 0o700 });
  await writeFile(args[3], JSON.stringify(manifest, null, 2) + "\n", {
    mode: 0o600,
    flag: "wx",
  });
  console.log(
    JSON.stringify({
      collections: manifest.collections.length,
      documents: manifest.collections.reduce((n, c) => n + c.count, 0),
      manifest: args[3],
    }),
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main().catch(() => {
    // Driver errors can contain connection details; never print them here.
    console.error(
      "Database verification failed. Check arguments, connectivity, permissions and output path; no data was changed.",
    );
    process.exitCode = 1;
  });
}
