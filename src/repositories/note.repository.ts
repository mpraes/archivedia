import type { Note } from "@/domain/note";

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
}
