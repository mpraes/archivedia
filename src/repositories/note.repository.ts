import type { Note } from "@/domain/note";
import type { NoteStatus } from "@/domain/note-status";

/**
 * Repository contract for notes. Concrete implementations live next to
 * this file (Postgres-backed) or in tests (in-memory fake).
 */
export interface NotePatch {
  content?: string;
  tags?: string[];
  /** Pre-computed by the service from `content` when content changes. */
  linkedNoteIds?: string[];
}

export interface NoteRepository {
  insert(input: {
    publicId: string;
    content: string;
    linkedNoteIds: string[];
    tags: string[];
    createdAt: Date;
  }): Promise<Note>;
  findActiveById(id: string): Promise<Note | null>;
  findActiveByPublicId(publicId: string): Promise<Note | null>;
  listByDay(start: Date, end: Date, limit: number): Promise<Note[]>;
  softDelete(id: string, deletedAt: Date): Promise<boolean>;
  countByPublicIdPrefix(prefix: string): Promise<number>;
  findActiveByContentInBucketPrefix(
    content: string,
    bucketPrefix: string,
  ): Promise<Note | null>;
  /**
   * Atomic partial update. `patch` may include any subset of content, tags,
   * and pre-computed linkedNoteIds. When content is present the service
   * should also recompute linkedNoteIds; when content is absent the
   * stored linkedNoteIds are left untouched (and any incoming
   * linkedNoteIds are ignored).
   */
  patchNote(id: string, patch: NotePatch, updatedAt: Date): Promise<Note | null>;
  /**
   * Update content and status atomically. Returns:
   * - the updated note on success
   * - null when the note is missing or soft-deleted
   * - throws NoteNotProcessable when the note exists but is not in `fromStatus`
   */
  updateContentAndStatus(
    id: string,
    content: string,
    linkedNoteIds: string[],
    updatedAt: Date,
    fromStatus: NoteStatus,
    toStatus: NoteStatus,
  ): Promise<Note | null>;
  /**
   * Cross-day, multi-filter list. `q` matches content via ILIKE, `status`
   * narrows by note status, `tag` narrows by tag membership. When no
   * filter is provided, returns `limit` notes ordered by createdAt DESC.
   */
  listWithFilters(input: {
    q?: string;
    status?: NoteStatus;
    tag?: string;
    limit: number;
  }): Promise<Note[]>;
  /**
   * All active notes whose `linkedNoteIds` contain the target publicId.
   * Used by the backlinks panel to surface inbound references.
   */
  findBacklinks(targetPublicId: string, limit: number): Promise<Note[]>;
}

export class NoteNotProcessable extends Error {
  readonly currentStatus: NoteStatus;
  constructor(currentStatus: NoteStatus) {
    super(`NOTE_NOT_PROCESSABLE:${currentStatus}`);
    this.name = "NoteNotProcessable";
    this.currentStatus = currentStatus;
  }
}
