export function requiredText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export function positiveNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0;
}

export function validPercentage(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100;
}

export function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "").trim();
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}
