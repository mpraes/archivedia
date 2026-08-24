import type { Note } from "@/domain/note";
import type { NoteStatus } from "@/domain/note-status";
import { NoteNotProcessable, type NoteRepository } from "./note.repository";

/**
 * In-memory fake for unit tests. Keeps the public contract faithful
 * without dragging the Postgres dependency into the test process.
 */
export class InMemoryNoteRepository implements NoteRepository {
  private rows = new Map<string, Note>();
  private counter = 0;

  async insert(input: { publicId: string; content: string; createdAt: Date }): Promise<Note> {
    this.counter += 1;
    const id = `00000000-0000-0000-0000-${String(this.counter).padStart(12, "0")}`;
    const note: Note = {
      id,
      publicId: input.publicId,
      content: input.content,
      status: "inbox",
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      deletedAt: null,
    };
    this.rows.set(id, note);
    return note;
  }

  async findActiveById(id: string): Promise<Note | null> {
    const row = this.rows.get(id);
    return row && row.deletedAt === null ? row : null;
  }

  async listByDay(start: Date, end: Date, limit: number): Promise<Note[]> {
    return [...this.rows.values()]
      .filter((n) => n.deletedAt === null && n.createdAt >= start && n.createdAt < end)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async updateContent(id: string, content: string, updatedAt: Date): Promise<Note> {
    const current = this.rows.get(id);
    if (!current || current.deletedAt !== null) throw new Error("NOTE_GONE");
    const next: Note = { ...current, content, updatedAt };
    this.rows.set(id, next);
    return next;
  }

  async softDelete(id: string, deletedAt: Date): Promise<boolean> {
    const current = this.rows.get(id);
    if (!current || current.deletedAt !== null) return false;
    this.rows.set(id, { ...current, deletedAt });
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

  async updateContentAndStatus(
    id: string,
    content: string,
    updatedAt: Date,
    fromStatus: NoteStatus,
    toStatus: NoteStatus,
  ): Promise<Note | null> {
    const current = this.rows.get(id);
    if (!current || current.deletedAt !== null) return null;
    if (current.status !== fromStatus) throw new NoteNotProcessable(current.status);
    const next: Note = { ...current, content, updatedAt, status: toStatus };
    this.rows.set(id, next);
    return next;
  }
}
