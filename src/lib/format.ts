/**
 * Browser-side date helpers. The server stores UTC and ships ISO 8601;
 * the UI renders in the active locale (resolved at the call site so we
 * don't have to round-trip the locale through props everywhere).
 */

import { todayInTimezone } from "./day-range";

const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const DEFAULT_LOCALE = "pt-BR";

export function getConfiguredTimezone(): string {
  return process.env.NEXT_PUBLIC_APP_TIMEZONE ?? DEFAULT_TIMEZONE;
}

export function formatLocalDate(iso: string, locale: string = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: getConfiguredTimezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function formatLocalTime(iso: string, locale: string = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: getConfiguredTimezone(),
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatLocalDateTime(iso: string, locale: string = DEFAULT_LOCALE): string {
  return `${formatLocalDate(iso, locale)} · ${formatLocalTime(iso, locale)}`;
}

/** Today in the configured timezone, formatted as YYYY-MM-DD. */
export function todayDateString(): string {
  return todayInTimezone(getConfiguredTimezone());
}

export function preview(content: string, max = 140): string {
  const collapsed = content.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  return `${collapsed.slice(0, max - 1).trimEnd()}…`;
}

export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + days);
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utc.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
