import type { NoteStatus } from "./note-status";

/**
 * Domain entity as exposed by services and the API. Persistence concerns
 * stay in repositories; this is the shape the rest of the app sees.
 */
export interface Note {
  readonly id: string;
  readonly publicId: string;
  readonly content: string;
  readonly status: NoteStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}
