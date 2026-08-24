import type { Note } from "@/domain/note";
import { AppError, ErrorCode } from "@/errors/app-error";
import { assertValidTimezone, dayRangeUtc, todayInTimezone } from "@/lib/day-range";
import type { NoteServiceDeps } from "./dependencies";

export interface ListDailyResult {
  notes: Note[];
  date: string;
  timezone: string;
  total: number;
}

const DEFAULT_LIMIT = 100;

export async function listDailyNotes(
  deps: NoteServiceDeps,
  query: { date?: string; timezone?: string; limit?: number },
): Promise<ListDailyResult> {
  const timezone = query.timezone ?? deps.timezone;
  assertValidTimezone(timezone);

  const date = query.date ?? todayInTimezone(timezone);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw AppError.invalidDate();

  const { start, end } = dayRangeUtc(date, timezone);
  const limit = clampLimit(query.limit);
  const notes = await deps.repository.listByDay(start, end, limit);

  return { notes, date, timezone, total: notes.length };
}

function clampLimit(value: number | undefined): number {
  if (value === undefined) return DEFAULT_LIMIT;
  if (!Number.isFinite(value) || value < 1) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid limit.", 422);
  }
  return Math.min(value, 500);
}
