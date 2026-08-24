import type { Note } from "@/domain/note";
import { AppError } from "@/errors/app-error";
import type { NoteServiceDeps } from "./dependencies";

export async function updateNote(
  deps: NoteServiceDeps,
  id: string,
  content: string,
  now: Date = new Date(),
): Promise<Note> {
  try {
    return await deps.repository.updateContent(id, content, now);
  } catch (err) {
    if (err instanceof Error && err.message === "NOTE_GONE") throw AppError.notFound();
    throw AppError.databaseUnavailable();
  }
}
