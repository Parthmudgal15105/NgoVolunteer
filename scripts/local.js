import mongoose from "mongoose";
import { localDatabase } from "./local-database.js";
const { mongo, uri } = await localDatabase();
await mongoose.connect(uri);
const { default: app } = await import("../server/app.js");
const server = app.listen(5001, "127.0.0.1", () =>
  console.log(
    "Persistent NGO API ready at http://localhost:5001. Real data is stored in .data/mongodb.",
  ),
);
async function stop() {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await mongo.stop({ doCleanup: false });
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
