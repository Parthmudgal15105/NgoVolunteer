import "dotenv/config";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
dotenv.config({ path: fileURLToPath(new URL(".env", import.meta.url)) });
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
  throw new Error("Set JWT_SECRET to at least 32 characters in server/.env");
const { connectDB } = await import("./config/db.js");
const { default: app } = await import("./app.js");
try {
  await connectDB();
  app.listen(process.env.PORT || 5001, () =>
    console.log(
      `API listening on http://localhost:${process.env.PORT || 5001}`,
    ),
  );
} catch (error) {
  console.error(
    "MongoDB connection failed. Configure MONGODB_URI in server/.env.",
    error.message,
  );
  process.exit(1);
}
