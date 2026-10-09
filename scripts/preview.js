// Disposable seeded database for local review; use npm run dev for persistent application data.
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
process.env.JWT_SECRET = "local-preview-secret-at-least-32-characters";
const mongo = await MongoMemoryServer.create();
await mongoose.connect(mongo.getUri());
const { seed } = await import("../server/seed.js");
await seed();
const { default: app } = await import("../server/app.js");
const server = app.listen(5001, () =>
  console.log(
    "Disposable preview API ready on port 5001. Data resets when stopped.",
  ),
);
async function stop() {
  server.close();
  await mongoose.disconnect();
  await mongo.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
