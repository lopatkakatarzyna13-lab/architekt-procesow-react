export const DEFAULT_WORK_MODE = "guided";

export function normalizeWorkMode(value) {
  return value === "expert" ? "expert" : DEFAULT_WORK_MODE;
}