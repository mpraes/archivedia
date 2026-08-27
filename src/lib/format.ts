/**
 * Browser-side formatting helpers: dates and text previews. The server
 * stores UTC and ships ISO 8601; the UI renders in the active locale
 * (resolved at the call site so we don't have to round-trip the locale
 * through props everywhere).
 */

import { todayInTimezone } from "./day-range";

const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const DEFAULT_LOCALE = "pt-BR";

export function getConfiguredTimezone(): string {
  return process.env.NEXT_PUBLIC_APP_TIMEZONE ?? DEFAULT_TIMEZONE;
}

export function formatLocalDate(
  iso: string,
  locale: string = DEFAULT_LOCALE,
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: getConfiguredTimezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function formatLocalTime(
  iso: string,
  locale: string = DEFAULT_LOCALE,
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: getConfiguredTimezone(),
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatLocalDateTime(
  iso: string,
  locale: string = DEFAULT_LOCALE,
): string {
  return `${formatLocalDate(iso, locale)} · ${formatLocalTime(iso, locale)}`;
}

/** Today in the configured timezone, formatted as YYYY-MM-DD. */
export function todayDateString(): string {
  return todayInTimezone(getConfiguredTimezone());
}

/**
 * Whole-day distance between two ISO timestamps, measured in the configured
 * timezone so "today" lines up with what the user sees on the calendar.
 *
 * Returns 0 when the dates fall on the same day, 1 for yesterday, etc.
 * Negative values mean `iso` is in the future relative to `now` (treated
 * as 0 by the aging label helpers).
 */
export function daysBetween(
  iso: string,
  now: Date = new Date(),
  timezone: string = getConfiguredTimezone(),
): number {
  // Floor to start-of-day in the target timezone, then compare as UTC ms.
  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  const toUtcMidnight = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const past = toUtcMidnight(dayKey(new Date(iso)));
  const present = toUtcMidnight(dayKey(now));
  return Math.round((present - past) / 86_400_000);
}

export type AgingLabel =
  | { kind: "today" }
  | { kind: "yesterday" }
  | { kind: "days_ago"; count: number };

/** Compute a human-friendly label describing how old an item is. Pure,
 *  so callers can pass `now` for deterministic tests. */
export function agingLabel(
  iso: string,
  now: Date = new Date(),
  timezone: string = getConfiguredTimezone(),
): AgingLabel {
  const days = daysBetween(iso, now, timezone);
  if (days <= 0) return { kind: "today" };
  if (days === 1) return { kind: "yesterday" };
  return { kind: "days_ago", count: days };
}

/** True when an inbox note has aged past the 48-hour review threshold. */
export function isNeedingReview(
  iso: string,
  now: Date = new Date(),
  timezone: string = getConfiguredTimezone(),
): boolean {
  return daysBetween(iso, now, timezone) >= 2;
}

/**
 * FR-27 review threshold. Exported so the repository query and the UI
 * stay in lockstep — change one and you change the other.
 */
export const REVIEW_THRESHOLD_HOURS = 48;

export interface ReviewGate {
  /** Hard age cutoff: notes captured before this are eligible. */
  readonly earliestCreatedAt: Date;
  /** "Remind me again" deadline: notes with a future `nextReviewAt`
   *  are excluded until that timestamp passes. */
  readonly now: Date;
}

/**
 * Build the gate predicates used by the Review queue query. Pure so it
 * can be unit-tested without a database.
 */
export function reviewGate(now: Date = new Date()): ReviewGate {
  const earliest = new Date(now.getTime() - REVIEW_THRESHOLD_HOURS * 60 * 60 * 1000);
  return { earliestCreatedAt: earliest, now };
}

/**
 * Authoritative "does this note belong in the Review queue?" predicate.
 * Used both by the repository query (translated into a WHERE clause)
 * and by UI surfaces (e.g. the Today alert banner).
 */
export function requiresReview(
  note: {
    status: "inbox" | "permanent" | "deleted";
    createdAt: Date;
    nextReviewAt: Date | null;
    deletedAt: Date | null;
  },
  now: Date = new Date(),
): boolean {
  if (note.status !== "inbox") return false;
  if (note.deletedAt !== null) return false;
  if (note.createdAt > now) return false;
  const gate = reviewGate(now);
  if (note.createdAt > gate.earliestCreatedAt) return false;
  if (note.nextReviewAt !== null && note.nextReviewAt > now) return false;
  return true;
}

/** Whole hours elapsed between a note's creation and `now`, floored.
 *  Negative values (future timestamps) clamp to 0. Used to compute
 *  `waitingSinceHours` for the API response shape in FR-31. */
export function hoursWaitingSince(createdAt: Date, now: Date = new Date()): number {
  const ms = now.getTime() - createdAt.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / (60 * 60 * 1000));
}

export function preview(content: string, max = 140): string {
  const collapsed = content.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  return `${collapsed.slice(0, max - 1).trimEnd()}…`;
}

/** Invisible marker used to delimit the optional "Why" block. It lets
 *  the list preview strip the block without having to know the active
 *  locale or match free-form user text. */
const WHY_SENTINEL = "\u200B";

export function appendWhyBlock(
  content: string,
  title: string,
  answer: string,
): string {
  return `${content}\n\n${WHY_SENTINEL}— ${title} —${WHY_SENTINEL}\n${answer}`;
}

export function displayPreview(content: string, max = 140): string {
  // Strip the optional "Why" block appended by CaptureForm so the note
  // list shows only the body, not the localized separator.
  const blockStart = new RegExp(
    `\\n\\n${WHY_SENTINEL}— [\\s\\S]*? —${WHY_SENTINEL}\\n[\\s\\S]*$`,
  );
  return preview(content.replace(blockStart, ""), max);
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
