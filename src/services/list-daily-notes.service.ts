import type { Note } from "@/domain/note";
import type { NoteStatus } from "@/domain/note-status";
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

export interface ListNotesQuery {
  date?: string;
  timezone?: string;
  limit?: number;
  /** Cross-day content search; when present, `date` is ignored. */
  q?: string;
  /** Filter by note status (e.g. "permanent"). */
  status?: NoteStatus;
  /** Filter by tag membership. */
  tag?: string;
}

/**
 * List notes for the requested view.
 *
 * Routing rules:
 * - When any of `q` / `status` / `tag` is provided, the search goes through
 *   `listWithFilters` and ignores `date`. This is the cross-day recall
 *   path used by search, permanent-only view, and tag view.
 * - Otherwise the day-scoped `listByDay` is used (the partial index keeps
 *   it fast even with thousands of stored notes).
 */
export async function listDailyNotes(
  deps: NoteServiceDeps,
  query: ListNotesQuery,
): Promise<ListDailyResult> {
  const timezone = query.timezone ?? deps.timezone;
  assertValidTimezone(timezone);

  const isCrossDay =
    typeof query.q === "string" ||
    typeof query.status === "string" ||
    typeof query.tag === "string";

  const limit = clampLimit(query.limit);
  let notes: Note[];
  let date: string;

  if (isCrossDay) {
    notes = await deps.repository.listWithFilters({
      q: query.q,
      status: query.status,
      tag: query.tag,
      limit,
    });
    // When searching across days, `date` is not meaningful; surface the
    // requested date (or today) so the response shape stays uniform.
    date = query.date ?? todayInTimezone(timezone);
  } else {
    date = query.date ?? todayInTimezone(timezone);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw AppError.invalidDate();
    const { start, end } = dayRangeUtc(date, timezone);
    notes = await deps.repository.listByDay(start, end, limit);
  }

  return { notes, date, timezone, total: notes.length };
}

function clampLimit(value: number | undefined): number {
  if (value === undefined) return DEFAULT_LIMIT;
  if (!Number.isFinite(value) || value < 1) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid limit.", 422);
  }
  return Math.min(value, 500);
}
