import mongoose from "mongoose";
export const connectDB = () =>
  mongoose.connect(
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ngo_volunteer",
    { serverSelectionTimeoutMS: 5000 },
  );
