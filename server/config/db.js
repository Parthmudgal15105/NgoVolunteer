import mongoose from "mongoose";
export const connectDB = () => {
  if (process.env.NODE_ENV === "production" && !process.env.MONGODB_URI)
    throw new Error("MONGODB_URI is required in production.");
  return mongoose.connect(
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ngo_volunteer",
    { serverSelectionTimeoutMS: 10000, maxPoolSize: 10 },
  );
};
