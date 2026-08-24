function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function pad3(value: number): string {
  return value.toString().padStart(3, "0");
}

/**
 * Format parts of a UTC date into the YYYYMMDD-HHmm-SSS public id stem.
 *
 * @example formatPublicIdStem(new Date("2026-08-24T14:32:05.000Z"), "America/Sao_Paulo", 1)
 * // => "20260824-1132-001"
 */
export function formatPublicIdStem(at: Date, timezone: string, sequence: number): string {
  // Render the timestamp in the application timezone so the human-readable
  // identifier matches the wall-clock the user actually saw.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);

  const lookup: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") lookup[part.type] = part.value;
  }

  const date = `${lookup.year}${lookup.month}${lookup.day}`;
  const time = `${lookup.hour}${lookup.minute}`;
  return `${date}-${time}-${pad3(sequence)}`;
}

/**
 * Generate a collision-resistant public id by appending a short random
 * suffix to the readable stem. Used when the in-minute sequence lookup
 * is not feasible (cold path, single-row inserts in migrations, etc.).
 */
export function generatePublicId(at: Date, timezone: string, sequence: number): string {
  const stem = formatPublicIdStem(at, timezone, sequence);
  // 8-char random tail keeps URLs short while staying effectively unique.
  const tail = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${stem}-${tail}`;
}

/**
 * Compute the current minute-bucket prefix (YYYYMMDD-HHmm) for an instant
 * in the application timezone. Used to scope the in-minute sequence lookup.
 */
export function minuteBucket(at: Date, timezone: string): string {
  return formatPublicIdStem(at, timezone, 0).slice(0, -4);
}
