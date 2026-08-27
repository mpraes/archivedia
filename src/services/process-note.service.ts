import type { Note } from "@/domain/note";
import { AppError } from "@/errors/app-error";
import { logDbFailure } from "@/lib/logger";
import { extractLinkedNoteIds } from "@/lib/note-links";
import { NoteNotProcessable } from "@/repositories/note.repository";
import type { NoteServiceDeps } from "./dependencies";

/**
 * Promote a fleeting inbox note into a permanent note by rewriting its
 * content and transitioning its status from `inbox` to `permanent` in
 * a single atomic write. The technical id, public id, and creation
 * timestamp are preserved (FR-18); only `updatedAt` moves forward. The
 * wiki-link list is recomputed from the new content.
 *
 * Failures:
 * - missing or soft-deleted note → AppError.notFound (404)
 * - note already permanent (or any other status) → AppError.notProcessable (409)
 * - repository transient failure → AppError.databaseUnavailable (503)
 */
export async function processNote(
  deps: NoteServiceDeps,
  id: string,
  content: string,
  now: Date = new Date(),
): Promise<Note> {
  try {
    const linkedNoteIds = extractLinkedNoteIds(content);
    const updated = await deps.repository.updateContentAndStatus(
      id,
      content,
      linkedNoteIds,
      now,
      "inbox",
      "permanent",
    );
    if (!updated) throw AppError.notFound();
    return updated;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof NoteNotProcessable) throw AppError.notProcessable();
    logDbFailure({ component: "process_note", op: "update_status", err, noteId: id });
    throw AppError.databaseUnavailable();
  }
}
