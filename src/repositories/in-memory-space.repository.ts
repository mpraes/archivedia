import type { Space, SpaceStatus } from "@/domain/space";
import type { SpaceNote, SpaceNoteAddedBy } from "@/domain/space-note";
import type { SpaceNoteRepository } from "./space-note.repository";
import type { SpacePatch, SpaceRepository } from "./space.repository";

function normaliseDescription(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * In-memory fakes for Spaces + SpaceNotes. Kept in one file because
 * the join logic is tightly coupled to the Space entity in tests.
 */
export class InMemorySpaceRepository implements SpaceRepository {
  private rows = new Map<string, Space>();
  private counter = 0;

  async insert(input: {
    title: string;
    description: string | null;
    now: Date;
  }): Promise<Space> {
    this.counter += 1;
    const id = `00000000-0000-0000-0000-${String(this.counter).padStart(12, "0")}`;
    const space: Space = {
      id,
      title: input.title.trim(),
      description: normaliseDescription(input.description),
      status: "active",
      createdAt: input.now,
      updatedAt: input.now,
    };
    this.rows.set(id, space);
    return space;
  }

  async findById(id: string): Promise<Space | null> {
    return this.rows.get(id) ?? null;
  }

  async list(input: { includeArchived: boolean; limit: number }): Promise<Space[]> {
    return [...this.rows.values()]
      .filter((s) => (input.includeArchived ? true : s.status !== "archived"))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, input.limit);
  }

  async countByStatus(): Promise<Record<SpaceStatus, number>> {
    const counts: Record<SpaceStatus, number> = {
      active: 0,
      completed: 0,
      archived: 0,
    };
    for (const row of this.rows.values()) counts[row.status] += 1;
    return counts;
  }

  async countNotes(_spaceId: string): Promise<number> {
    // The in-memory test harness threads the join repo in separately;
    // tests that exercise the join should query it directly.
    return 0;
  }

  async patch(id: string, patch: SpacePatch, updatedAt: Date): Promise<Space | null> {
    const current = this.rows.get(id);
    if (!current) return null;
    const next: Space = {
      ...current,
      title: patch.title !== undefined ? patch.title.trim() : current.title,
      description:
        patch.description !== undefined
          ? normaliseDescription(patch.description)
          : current.description,
      status: patch.status ?? current.status,
      updatedAt,
    };
    if (next.title.length === 0) {
      throw new Error("SPACE_TITLE_EMPTY");
    }
    this.rows.set(id, next);
    return next;
  }
}

export class InMemorySpaceNoteRepository implements SpaceNoteRepository {
  private rows = new Map<string, SpaceNote>();

  private key(spaceId: string, noteId: string): string {
    return `${spaceId}:${noteId}`;
  }

  async add(input: {
    spaceId: string;
    noteId: string;
    addedBy: SpaceNoteAddedBy;
    addedAt: Date;
  }): Promise<SpaceNote> {
    const row: SpaceNote = {
      spaceId: input.spaceId,
      noteId: input.noteId,
      addedAt: input.addedAt,
      addedBy: input.addedBy,
    };
    this.rows.set(this.key(input.spaceId, input.noteId), row);
    return row;
  }

  async remove(spaceId: string, noteId: string): Promise<boolean> {
    return this.rows.delete(this.key(spaceId, noteId));
  }

  async listNoteIdsBySpace(input: { spaceId: string; limit: number }): Promise<string[]> {
    return [...this.rows.values()]
      .filter((row) => row.spaceId === input.spaceId)
      .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())
      .slice(0, input.limit)
      .map((row) => row.noteId);
  }

  async listSpaceIdsByNote(input: { noteId: string; limit: number }): Promise<string[]> {
    return [...this.rows.values()]
      .filter((row) => row.noteId === input.noteId)
      .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())
      .slice(0, input.limit)
      .map((row) => row.spaceId);
  }
}
