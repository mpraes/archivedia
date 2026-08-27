import type { Note } from "@/domain/note";
import { AppError } from "@/errors/app-error";
import { logDbFailure } from "@/lib/logger";
import { extractLinkedNoteIds } from "@/lib/note-links";
import { NoteNotProcessable } from "@/repositories/note.repository";
import type { NoteServiceDeps } from "./dependencies";

/**
 * FR-32 / FR-36: promote an inbox note to permanent from the Review
 * page. Accepts an optional `whyItMatters` so the user can fill in or
 * refine the "Why does this matter?" answer at the same time they
 * commit the note to the durable archive. Bumps reviewCount and
 * stamps processedAt + lastReviewedAt.
 *
 * Failures:
 * - missing or soft-deleted note → AppError.notFound (404)
 * - note already permanent (or any other non-inbox status) →
 *   AppError.notProcessable (409)
 * - repository transient failure → AppError.databaseUnavailable (503)
 */
export async function makePermanent(
  deps: NoteServiceDeps,
  id: string,
  content: string,
  whyItMatters: string | null,
  now: Date = new Date(),
): Promise<Note> {
  try {
    const linkedNoteIds = extractLinkedNoteIds(content);
    const updated = await deps.repository.promoteToPermanent({
      id,
      content,
      linkedNoteIds,
      whyItMatters,
      processedAt: now,
      lastReviewedAt: now,
      updatedAt: now,
    });
    if (!updated) throw AppError.notFound();
    return updated;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof NoteNotProcessable) throw AppError.notProcessable();
    logDbFailure({ component: "make_permanent", op: "promote", err, noteId: id });
    throw AppError.databaseUnavailable();
  }
}
