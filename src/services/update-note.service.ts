import type { Note } from "@/domain/note";
import { AppError } from "@/errors/app-error";
import { extractLinkedNoteIds, normaliseTags } from "@/lib/note-links";
import type { NoteServiceDeps } from "./dependencies";

export interface UpdateNotePatch {
  content?: string;
  tags?: string[];
}

/**
 * Partial-update an existing note. At least one of `content` / `tags` must
 * be present; the service rejects an empty patch with a 422. When content
 * changes the service re-extracts `[[publicId]]` references and overwrites
 * the stored `linkedNoteIds`; when content is absent the existing
 * `linkedNoteIds` are preserved. Tags are always normalised on write
 * (trimmed, lowercased, deduped).
 *
 * Errors:
 * - missing or soft-deleted note → AppError.notFound (404)
 * - empty patch → AppError.validation (422)
 * - repository transient failure → AppError.databaseUnavailable (503)
 */
export async function updateNote(
  deps: NoteServiceDeps,
  id: string,
  patch: UpdateNotePatch,
  now: Date = new Date(),
): Promise<Note> {
  const hasContent = typeof patch.content === "string";
  const hasTags = Array.isArray(patch.tags);

  if (!hasContent && !hasTags) {
    throw AppError.validation(
      { _: "Provide at least one of `content` or `tags` to update." },
      "Empty update patch.",
    );
  }

  if (hasContent) {
    const trimmed = patch.content!.trim();
    if (trimmed.length === 0) {
      throw AppError.validation(
        { content: "Provide a note containing at least one non-whitespace character." },
        "Note content cannot be empty.",
      );
    }
    patch = { ...patch, content: trimmed };
  }

  const repositoryPatch: {
    content?: string;
    tags?: string[];
    linkedNoteIds?: string[];
  } = {};
  if (hasContent) {
    repositoryPatch.content = patch.content;
    repositoryPatch.linkedNoteIds = extractLinkedNoteIds(patch.content!);
  }
  if (hasTags) {
    repositoryPatch.tags = normaliseTags(patch.tags);
  }

  try {
    const updated = await deps.repository.patchNote(id, repositoryPatch, now);
    if (!updated) throw AppError.notFound();
    return updated;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw AppError.databaseUnavailable();
  }
}
