import "dotenv/config";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { validateEnvironment } from "./config/environment.js";
dotenv.config({ path: fileURLToPath(new URL(".env", import.meta.url)) });
validateEnvironment();
const { connectDB } = await import("./config/db.js");
const { default: app } = await import("./app.js");
try {
  await connectDB();
  const server = app.listen(process.env.PORT || 5001, "0.0.0.0", () =>
    console.log(`API listening on port ${process.env.PORT || 5001}`),
  );
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    // Drain active requests before closing MongoDB during a Render shutdown.
    const timeout = setTimeout(() => process.exit(1), 25000);
    timeout.unref();
    server.close(async () => {
      await mongoose.disconnect();
      clearTimeout(timeout);
      process.exit(0);
    });
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
} catch (error) {
  console.error(
    "MongoDB connection failed. Configure MONGODB_URI in server/.env.",
    process.env.NODE_ENV === "production"
      ? "Check database access and credentials."
      : error.message,
  );
  process.exit(1);
}
