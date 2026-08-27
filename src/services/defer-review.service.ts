import type { Note } from "@/domain/note";
import { AppError } from "@/errors/app-error";
import { logDbFailure } from "@/lib/logger";
import { NoteNotProcessable } from "@/repositories/note.repository";
import type { NoteServiceDeps } from "./dependencies";

/**
 * FR-34 / FR-36: keep a note in the inbox but push the next review
 * deadline into the future so it exits the queue until then. The user
 * can optionally include a reason for the postpone (for future use —
 * it is currently logged at debug level only).
 *
 * Failures:
 * - missing or soft-deleted note → AppError.notFound (404)
 * - note already permanent/deleted → AppError.notProcessable (409)
 * - repository transient failure → AppError.databaseUnavailable (503)
 */
export async function deferReview(
  deps: NoteServiceDeps,
  id: string,
  nextReviewAt: Date,
  _reason: string | null,
  now: Date = new Date(),
): Promise<Note> {
  if (Number.isNaN(nextReviewAt.getTime())) {
    throw AppError.validation(
      { nextReviewAt: "Provide an ISO 8601 timestamp." },
      "Invalid nextReviewAt.",
    );
  }
  try {
    const updated = await deps.repository.deferReview({
      id,
      nextReviewAt,
      lastReviewedAt: now,
      updatedAt: now,
    });
    if (!updated) throw AppError.notFound();
    return updated;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof NoteNotProcessable) throw AppError.notProcessable();
    logDbFailure({ component: "defer_review", op: "defer", err, noteId: id });
    throw AppError.databaseUnavailable();
  }
}
