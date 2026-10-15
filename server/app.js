import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import api from "./routes/api.js";
import mongoose from "mongoose";
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", Number(process.env.TRUST_PROXY || 0));
app.use(helmet());
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
app.use(cors({ origin: clientOrigin }));
app.use(express.json({ limit: "100kb" }));
app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    message: { message: "Too many attempts. Please try again later." },
  }),
);
app.get("/api/health", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (mongoose.connection.readyState !== 1)
      throw new Error("Database unavailable");
    await mongoose.connection.db.command({ ping: 1 }, { timeoutMS: 3000 });
    res.json({ status: "ok", database: "connected" });
  } catch {
    res.status(503).json({ status: "unavailable", database: "unavailable" });
  }
});
app.use("/api", api);
app.use((req, res) => res.status(404).json({ message: "Endpoint not found." }));
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const invalidBody = ["entity.parse.failed", "entity.too.large"].includes(
    err.type,
  );
  res.status(invalidBody ? err.status || 400 : 500).json({
    message: invalidBody
      ? "Invalid request body."
      : "Something went wrong. Please try again.",
  });
});
export default app;
