import { AppError } from "@/errors/app-error";

/**
 * Validate that a string is a YYYY-MM-DD date in the calendar (rejects
 * 2026-02-30 etc.) and return a Date pinned to UTC midnight.
 */
export function parseCalendarDate(input: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw AppError.invalidDate();
  }
  const [year, month, day] = input.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw AppError.invalidDate();
  }
  return utc;
}

/**
 * Validate an IANA timezone string by exercising Intl. Throws an
 * INVALID_TIMEZONE error if the runtime cannot resolve the zone.
 */
export function assertValidTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    throw AppError.invalidTimezone();
  }
}

/**
 * Return the [start, end) UTC range that covers the given local date in
 * the provided timezone. End is exclusive so callers can use it directly
 * with SQL half-open comparisons.
 *
 * @example dayRangeUtc("2026-08-24", "America/Sao_Paulo")
 * // => [2026-08-24T03:00:00Z, 2026-08-25T03:00:00Z)
 */
export function dayRangeUtc(date: string, timezone: string): { start: Date; end: Date } {
  const startLocal = parseCalendarDate(date);
  // Add 24h and convert back; for DST shifts this can drift, so we anchor
  // to the timezone's wall-clock midnight of the *next* day.
  const nextDay = new Date(startLocal.getTime() + 24 * 60 * 60 * 1000);

  // Compute offset for the requested local midnight vs UTC by formatting
  // both sides. If the offset differs across DST boundaries we use the
  // larger window to avoid dropping notes.
  const offsetMinutes = (anchor: Date): number => {
    const local = new Date(anchor.toLocaleString("en-US", { timeZone: timezone }));
    const utc = new Date(anchor.toLocaleString("en-US", { timeZone: "UTC" }));
    return Math.round((local.getTime() - utc.getTime()) / 60000);
  };

  const start = new Date(startLocal.getTime() - offsetMinutes(startLocal) * 60_000);
  const end = new Date(nextDay.getTime() - offsetMinutes(nextDay) * 60_000);
  return { start, end };
}

/** Today in the configured timezone, formatted as YYYY-MM-DD. */
export function todayInTimezone(timezone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const lookup: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") lookup[p.type] = p.value;
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}
