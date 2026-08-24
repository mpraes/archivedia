import type { Note } from "@/domain/note";
import { AppError } from "@/errors/app-error";
import type { NoteServiceDeps } from "./dependencies";

export async function getNote(deps: NoteServiceDeps, id: string): Promise<Note> {
  const note = await deps.repository.findActiveById(id);
  if (!note) throw AppError.notFound();
  return note;
}
