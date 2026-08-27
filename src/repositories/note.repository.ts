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
    /** Optional first-class "Why does this matter?" answer (v0.7). */
    whyItMatters?: string | null;
    linkedNoteIds: string[];
    tags: string[];
    createdAt: Date;
  }): Promise<Note>;
  findActiveById(id: string): Promise<Note | null>;
  findActiveByPublicId(publicId: string): Promise<Note | null>;
  listByDay(start: Date, end: Date, limit: number): Promise<Note[]>;
  /**
   * Soft-delete: sets both `status = 'deleted'` and `deletedAt = now`.
   * Returns true when the row existed and was not already deleted.
   */
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
   * FR-32 / FR-36: promote an inbox note to permanent from the Review
   * page. Sets content + whyItMatters + processedAt + lastReviewedAt,
   * bumps reviewCount, and flips status to `permanent` — all atomically.
   * Returns null when the note is missing/deleted, throws
   * NoteNotProcessable when it is not currently in `inbox`.
   */
  promoteToPermanent(input: {
    id: string;
    content: string;
    linkedNoteIds: string[];
    whyItMatters: string | null;
    processedAt: Date;
    lastReviewedAt: Date;
    updatedAt: Date;
  }): Promise<Note | null>;
  /**
   * FR-34: keep the note in the inbox but bump `nextReviewAt` so it
   * exits the queue until that deadline. Stamps `lastReviewedAt`,
   * bumps `reviewCount`, and leaves content/status untouched. Returns
   * null when the note is missing/deleted, throws NoteNotProcessable
   * when the note is not currently in `inbox`.
   */
  deferReview(input: {
    id: string;
    nextReviewAt: Date;
    lastReviewedAt: Date;
    updatedAt: Date;
  }): Promise<Note | null>;
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
  /**
   * FR-30 / FR-31: inbox notes that pass the 48-hour review gate
   * (status = inbox AND createdAt <= now - 48h AND
   *  (nextReviewAt IS NULL OR nextReviewAt <= now) AND deletedAt IS NULL),
   * oldest first so the most overdue note comes up first in the queue.
   */
  listReviewQueue(input: { limit: number; now: Date }): Promise<Note[]>;
  /** Total size of the review queue (no limit). Cheap COUNT(*) query. */
  countReviewQueue(now: Date): Promise<number>;
}

export class NoteNotProcessable extends Error {
  readonly currentStatus: NoteStatus;
  constructor(currentStatus: NoteStatus) {
    super(`NOTE_NOT_PROCESSABLE:${currentStatus}`);
    this.name = "NoteNotProcessable";
    this.currentStatus = currentStatus;
  }
}
