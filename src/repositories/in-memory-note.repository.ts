import type { Note } from "@/domain/note";
import type { NoteStatus } from "@/domain/note-status";
import { requiresReview, reviewGate } from "@/lib/format";
import { NoteNotProcessable, type NotePatch, type NoteRepository } from "./note.repository";

/** Trim whitespace; treat empty strings as "no answer". Kept in this
 *  file (and not shared with Postgres) because the in-memory fake does
 *  not need to enforce the same column-level invariants as the DB. */
function normaliseWhyItMatters(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * In-memory fake for unit tests. Keeps the public contract faithful
 * without dragging the Postgres dependency into the test process.
 */
export class InMemoryNoteRepository implements NoteRepository {
  private rows = new Map<string, Note>();
  private counter = 0;

  async insert(input: {
    publicId: string;
    content: string;
    whyItMatters?: string | null;
    linkedNoteIds: string[];
    tags: string[];
    createdAt: Date;
  }): Promise<Note> {
    this.counter += 1;
    const id = `00000000-0000-0000-0000-${String(this.counter).padStart(12, "0")}`;
    const note: Note = {
      id,
      publicId: input.publicId,
      content: input.content,
      whyItMatters: normaliseWhyItMatters(input.whyItMatters),
      status: "inbox",
      linkedNoteIds: [...input.linkedNoteIds],
      tags: [...input.tags],
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      processedAt: null,
      lastReviewedAt: null,
      nextReviewAt: null,
      reviewCount: 0,
      deletedAt: null,
    };
    this.rows.set(id, note);
    return note;
  }

  async findActiveById(id: string): Promise<Note | null> {
    const row = this.rows.get(id);
    return row && row.deletedAt === null ? row : null;
  }

  async findActiveByPublicId(publicId: string): Promise<Note | null> {
    for (const row of this.rows.values()) {
      if (row.deletedAt !== null) continue;
      if (row.publicId === publicId) return row;
    }
    return null;
  }

  async listByDay(start: Date, end: Date, limit: number): Promise<Note[]> {
    return [...this.rows.values()]
      .filter((n) => n.deletedAt === null && n.createdAt >= start && n.createdAt < end)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async softDelete(id: string, deletedAt: Date): Promise<boolean> {
    const current = this.rows.get(id);
    if (!current || current.deletedAt !== null) return false;
    this.rows.set(id, { ...current, deletedAt, status: "deleted" });
    return true;
  }

  async countByPublicIdPrefix(prefix: string): Promise<number> {
    let count = 0;
    for (const row of this.rows.values()) {
      if (row.publicId.startsWith(prefix)) count += 1;
    }
    return count;
  }

  async findActiveByContentInBucketPrefix(
    content: string,
    bucketPrefix: string,
  ): Promise<Note | null> {
    for (const row of this.rows.values()) {
      if (row.deletedAt !== null) continue;
      if (row.content !== content) continue;
      if (!row.publicId.startsWith(bucketPrefix)) continue;
      return row;
    }
    return null;
  }

  async patchNote(id: string, patch: NotePatch, updatedAt: Date): Promise<Note | null> {
    const current = this.rows.get(id);
    if (!current || current.deletedAt !== null) return null;
    const next: Note = {
      ...current,
      updatedAt,
      content: patch.content !== undefined ? patch.content : current.content,
      tags: patch.tags !== undefined ? [...patch.tags] : current.tags,
      linkedNoteIds:
        patch.content !== undefined && patch.linkedNoteIds !== undefined
          ? [...patch.linkedNoteIds]
          : current.linkedNoteIds,
    };
    this.rows.set(id, next);
    return next;
  }

  async updateContentAndStatus(
    id: string,
    content: string,
    linkedNoteIds: string[],
    updatedAt: Date,
    fromStatus: NoteStatus,
    toStatus: NoteStatus,
  ): Promise<Note | null> {
    const current = this.rows.get(id);
    if (!current || current.deletedAt !== null) return null;
    if (current.status !== fromStatus) throw new NoteNotProcessable(current.status);
    const next: Note = {
      ...current,
      content,
      linkedNoteIds: [...linkedNoteIds],
      updatedAt,
      status: toStatus,
    };
    this.rows.set(id, next);
    return next;
  }

  async listWithFilters(input: {
    q?: string;
    status?: NoteStatus;
    tag?: string;
    limit: number;
  }): Promise<Note[]> {
    const q = input.q?.toLowerCase();
    return [...this.rows.values()]
      .filter((n) => n.deletedAt === null)
      .filter((n) => (q ? n.content.toLowerCase().includes(q) : true))
      .filter((n) => (input.status ? n.status === input.status : true))
      .filter((n) => (input.tag ? n.tags.includes(input.tag) : true))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, input.limit);
  }

  async findBacklinks(targetPublicId: string, limit: number): Promise<Note[]> {
    return [...this.rows.values()]
      .filter((n) => n.deletedAt === null)
      .filter((n) => n.linkedNoteIds.includes(targetPublicId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async listReviewQueue(input: { limit: number; now: Date }): Promise<Note[]> {
    const gate = reviewGate(input.now);
    void gate; // referenced for clarity; the predicate below uses input.now directly
    return [...this.rows.values()]
      .filter((n) => requiresReview(n, input.now))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, input.limit);
  }

  async countReviewQueue(now: Date): Promise<number> {
    return [...this.rows.values()].filter((n) => requiresReview(n, now)).length;
  }

  async promoteToPermanent(input: {
    id: string;
    content: string;
    linkedNoteIds: string[];
    whyItMatters: string | null;
    processedAt: Date;
    lastReviewedAt: Date;
    updatedAt: Date;
  }): Promise<Note | null> {
    const current = this.rows.get(input.id);
    if (!current || current.deletedAt !== null) return null;
    if (current.status !== "inbox") throw new NoteNotProcessable(current.status);
    const next: Note = {
      ...current,
      content: input.content,
      linkedNoteIds: [...input.linkedNoteIds],
      whyItMatters: normaliseWhyItMatters(input.whyItMatters),
      status: "permanent",
      processedAt: input.processedAt,
      lastReviewedAt: input.lastReviewedAt,
      updatedAt: input.updatedAt,
      reviewCount: current.reviewCount + 1,
    };
    this.rows.set(input.id, next);
    return next;
  }

  async deferReview(input: {
    id: string;
    nextReviewAt: Date;
    lastReviewedAt: Date;
    updatedAt: Date;
  }): Promise<Note | null> {
    const current = this.rows.get(input.id);
    if (!current || current.deletedAt !== null) return null;
    if (current.status !== "inbox") throw new NoteNotProcessable(current.status);
    const next: Note = {
      ...current,
      nextReviewAt: input.nextReviewAt,
      lastReviewedAt: input.lastReviewedAt,
      updatedAt: input.updatedAt,
      reviewCount: current.reviewCount + 1,
    };
    this.rows.set(input.id, next);
    return next;
  }
}
