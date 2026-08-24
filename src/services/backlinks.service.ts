import type { Note } from "@/domain/note";
import { AppError } from "@/errors/app-error";
import type { NoteServiceDeps } from "./dependencies";

/**
 * Backlinks for a given note: every active note whose content contains
 * a `[[targetPublicId]]` reference. The target id can be either the
 * technical UUID or the human-readable publicId; the service normalises
 * to the publicId before querying the repository.
 *
 * Returns 404 when the target note does not exist (or has been
 * soft-deleted). Backlinks themselves are returned in newest-first order.
 */
export async function getBacklinks(
  deps: NoteServiceDeps,
  idOrPublicId: string,
  limit = 100,
): Promise<Note[]> {
  const target =
    (await deps.repository.findActiveById(idOrPublicId)) ??
    (await deps.repository.findActiveByPublicId(idOrPublicId));
  if (!target) throw AppError.notFound();
  return deps.repository.findBacklinks(target.publicId, limit);
}
