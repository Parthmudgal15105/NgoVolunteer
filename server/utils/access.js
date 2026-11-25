import { User } from "../models/index.js";

export const departmentKey = (department) =>
  String(department || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
const inDepartment = (user, names) =>
  (user.departments || []).some((d) => names.includes(departmentKey(d)));
export const sameDepartment = (a, b) => departmentKey(a) === departmentKey(b);

export const isHR = (user) =>
  user?.role === "head" &&
  inDepartment(user, ["human resource", "human resources", "hr"]);
export const isOperationsHead = (user) =>
  user?.role === "head" &&
  inDepartment(user, ["operations", "operation", "operations department"]);

// Founders (BOT) and the Board of Directors hold the admin role.
export function permissions(user) {
  const admin = user?.role === "admin";
  const head = user?.role === "head";
  const hr = isHR(user);
  return {
    manageEvents: admin || isOperationsHead(user),
    manageMembers: admin || head,
    addVolunteers: admin || head,
    allVolunteers: admin || hr,
    issueCertificates: admin || head,
    editCertificates: admin || head,
    certificateFormat: admin || hr,
    manageRpRules: admin || head,
    announcements: admin,
    importedRecords: admin,
  };
}
export function requirePermission(name) {
  return (req, res, next) => {
    if (!permissions(req.user)[name])
      return res
        .status(403)
        .json({ message: "You do not have access to this action." });
    next();
  };
}

export function managedUsers(user) {
  if (user.role === "admin") return {};
  if (isHR(user)) return { role: "volunteer" };
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
// Departments a manager may assign new volunteers or RP rules to.
export function ownsDepartment(user, department) {
  if (user.role === "admin") return true;
  return (
    user.role === "head" &&
    (user.departments || []).some((d) => sameDepartment(d, department))
  );
}
