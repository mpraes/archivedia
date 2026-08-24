import type { Note } from "@/domain/note";
import { AppError } from "@/errors/app-error";
import { NoteNotProcessable } from "@/repositories/note.repository";
import type { NoteServiceDeps } from "./dependencies";

/**
 * Promote a fleeting inbox note into a permanent note by rewriting its
 * content and transitioning its status from `inbox` to `permanent` in
 * a single atomic write. The technical id, public id, and creation
 * timestamp are preserved (FR-18); only `updatedAt` moves forward.
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
    const updated = await deps.repository.updateContentAndStatus(
      id,
      content,
      now,
      "inbox",
      "permanent",
    );
    if (!updated) throw AppError.notFound();
    return updated;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof NoteNotProcessable) throw AppError.notProcessable();
    throw AppError.databaseUnavailable();
  }
}
