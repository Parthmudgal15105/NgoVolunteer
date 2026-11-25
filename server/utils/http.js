export const fail = (message, status = 400) => {
  const e = new Error(message);
  e.status = status;
  throw e;
};
export const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
export const text = (v, max = 500) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
// Blank form values mean "not set"; anything else must be a number in range.
export function optionalNumber(value, min, max, label) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max)
    fail(`${label} must be between ${min} and ${max}.`);
  return n;
}
