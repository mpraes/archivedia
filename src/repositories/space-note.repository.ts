import type { SpaceNote, SpaceNoteAddedBy } from "@/domain/space-note";

/**
 * Repository contract for the SpaceNote join. Membership rows are
 * looked up either by Space (for the Notes tab) or by Note (for the
 * inverse "Spaces containing this note" view). Both queries return
 * active (non-deleted) notes only.
 */
export interface SpaceNoteRepository {
  add(input: {
    spaceId: string;
    noteId: string;
    addedBy: SpaceNoteAddedBy;
    addedAt: Date;
  }): Promise<SpaceNote>;
  remove(spaceId: string, noteId: string): Promise<boolean>;
  /** Note IDs that belong to the given Space, newest first. */
  listNoteIdsBySpace(input: { spaceId: string; limit: number }): Promise<string[]>;
  /** Space IDs that contain the given Note, newest first. */
  listSpaceIdsByNote(input: { noteId: string; limit: number }): Promise<string[]>;
}
