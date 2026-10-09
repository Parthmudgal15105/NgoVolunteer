import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import api from "./routes/api.js";
const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "100kb" }));
app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    message: { message: "Too many attempts. Please try again later." },
  }),
);
app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api", api);
app.use((req, res) => res.status(404).json({ message: "Endpoint not found." }));
app.use((err, req, res, next) =>
  res.status(400).json({ message: "Invalid request body." }),
);
export default app;
