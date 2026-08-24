import type { NoteStatus } from "./note-status";

/**
 * Domain entity as exposed by services and the API. Persistence concerns
 * stay in repositories; this is the shape the rest of the app sees.
 *
 * `linkedNoteIds` holds the publicIds of every other note referenced by
 * `[[publicId]]` syntax in the content (v0.4). Extracted on save so that
 * backlinks stay cheap even when content grows long.
 *
 * `tags` holds the free-form, case-insensitive tags the user attached
 * to the note (v0.5). Stored normalised (trimmed, lowercased, deduped)
 * to keep filter queries predictable.
 */
export interface Note {
  readonly id: string;
  readonly publicId: string;
  readonly content: string;
  readonly status: NoteStatus;
  readonly linkedNoteIds: readonly string[];
  readonly tags: readonly string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}
