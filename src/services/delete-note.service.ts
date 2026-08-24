import { AppError } from "@/errors/app-error";
import type { NoteServiceDeps } from "./dependencies";

export async function deleteNote(
  deps: NoteServiceDeps,
  id: string,
  now: Date = new Date(),
): Promise<void> {
  const removed = await deps.repository.softDelete(id, now);
  if (!removed) throw AppError.notFound();
}
