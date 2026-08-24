import type { Note } from "@/domain/note";
import type { NoteStatus } from "@/domain/note-status";

/**
 * Repository contract for notes. Concrete implementations live next to
 * this file (Postgres-backed) or in tests (in-memory fake).
 */
export interface NoteRepository {
  insert(input: { publicId: string; content: string; createdAt: Date }): Promise<Note>;
  findActiveById(id: string): Promise<Note | null>;
  listByDay(start: Date, end: Date, limit: number): Promise<Note[]>;
  updateContent(id: string, content: string, updatedAt: Date): Promise<Note>;
  softDelete(id: string, deletedAt: Date): Promise<boolean>;
  countByPublicIdPrefix(prefix: string): Promise<number>;
  findActiveByContentInBucketPrefix(
    content: string,
    bucketPrefix: string,
  ): Promise<Note | null>;
  /**
   * Update content and status atomically. Returns:
   * - the updated note on success
   * - null when the note is missing or soft-deleted
   * - throws NoteNotProcessable when the note exists but is not in `fromStatus`
   */
  updateContentAndStatus(
    id: string,
    content: string,
    updatedAt: Date,
    fromStatus: NoteStatus,
    toStatus: NoteStatus,
  ): Promise<Note | null>;
}

export class NoteNotProcessable extends Error {
  readonly currentStatus: NoteStatus;
  constructor(currentStatus: NoteStatus) {
    super(`NOTE_NOT_PROCESSABLE:${currentStatus}`);
    this.name = "NoteNotProcessable";
    this.currentStatus = currentStatus;
  }
}
