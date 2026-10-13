export function isSocialDepartment(department) {
  return [
    "social & content",
    "social media",
    "social media department",
  ].includes(
    String(department || "")
      .trim()
      .toLowerCase(),
  );
}

export function contributionRP(record) {
  if (record.status !== "present") return 0;
  if (record.kind === "drive") return 5;
  if (!isSocialDepartment(record.sourceDepartment)) return 0;
  return { reel_edit: 3, misc: 2 }[record.kind] || 0;
}
