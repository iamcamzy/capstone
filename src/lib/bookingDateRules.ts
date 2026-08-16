export const ADVANCE_BOOKING_DAYS = 7;
export const ADVANCE_BOOKING_RULE_NAME = "one-week rule";
export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateOnly(value: string) {
  if (!DATE_ONLY_PATTERN.test(value)) return new Date(Number.NaN);

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return new Date(Number.NaN);
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

export function isDateOnly(value: string) {
  return !Number.isNaN(parseDateOnly(value).getTime());
}

export function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getTodayDateOnly(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function getMinimumBookingDate(now = new Date()) {
  return addDays(getTodayDateOnly(now), ADVANCE_BOOKING_DAYS);
}

export function getMinimumBookingDateValue(now = new Date()) {
  return formatDateOnly(getMinimumBookingDate(now));
}

export function isOnOrAfterMinimumBookingDate(value: string, now = new Date()) {
  return parseDateOnly(value) >= getMinimumBookingDate(now);
}
