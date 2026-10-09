import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
export async function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token)
      return res.status(401).json({ message: "Please log in to continue." });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(payload.id);
    if (!req.user?.active)
      return res.status(401).json({ message: "Account unavailable." });
    next();
  } catch {
    res
      .status(401)
      .json({ message: "Your session expired. Please log in again." });
  }
}
export function admin(req, res, next) {
  if (req.user.role !== "admin")
    return res.status(403).json({ message: "Administrator access required." });
  next();
}
export function manager(req, res, next) {
  if (!["admin", "head"].includes(req.user.role))
    return res
      .status(403)
      .json({ message: "Department head access required." });
  next();
}
