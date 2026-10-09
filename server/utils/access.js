import { User } from "../models/index.js";

export function managedUsers(user) {
  if (user.role === "admin") return {};
  if (user.role === "head")
    return {
      role: "volunteer",
      departments: { $in: user.departments || [] },
    };
  return { _id: user._id };
}
export async function participationScope(user) {
  if (user.role === "admin") return {};
  if (user.role === "head")
    return {
      volunteer: {
        $in: (await User.find(managedUsers(user)).select("_id")).map(
          (u) => u._id,
        ),
      },
    };
  return { volunteer: user._id };
}
export async function requireManaged(user, id) {
  if (user.role === "admin") return;
  if (
    user.role !== "head" ||
    !(await User.exists({ ...managedUsers(user), _id: id }))
  ) {
    const error = new Error(
      "You can only manage volunteers in your department.",
    );
    error.status = 403;
    throw error;
  }
}
