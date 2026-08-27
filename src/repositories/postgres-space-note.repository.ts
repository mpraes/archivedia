import type { SpaceNote as PrismaSpaceNote } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logDbFailure } from "@/lib/logger";
import type { SpaceNote, SpaceNoteAddedBy } from "@/domain/space-note";
import type { SpaceNoteRepository } from "./space-note.repository";

/**
 * The doc (requirements_v2 §"SpaceNote") uses `created-in-space` with
 * a hyphen to stay consistent with the rest of the spec's kebab-case
 * literals. Prisma's enum, on the other hand, stores it as
 * `created_in_space` (snake_case) because column-level enums are
 * identifiers, not strings. These two mappers bridge the two worlds
 * at the repository boundary so the rest of the app keeps the human
 * hyphenated shape.
 */
const DOMAIN_TO_DB: Record<SpaceNoteAddedBy, "manual" | "review" | "created_in_space"> = {
  manual: "manual",
  review: "review",
  "created-in-space": "created_in_space",
};

const DB_TO_DOMAIN: Record<
  "manual" | "review" | "created_in_space",
  SpaceNoteAddedBy
> = {
  manual: "manual",
  review: "review",
  created_in_space: "created-in-space",
};

function toDomain(row: PrismaSpaceNote): SpaceNote {
  return {
    spaceId: row.spaceId,
    noteId: row.noteId,
    addedAt: row.addedAt,
    addedBy: DB_TO_DOMAIN[row.addedBy],
  };
}

export class PostgresSpaceNoteRepository implements SpaceNoteRepository {
  async add(input: {
    spaceId: string;
    noteId: string;
    addedBy: SpaceNote["addedBy"];
    addedAt: Date;
  }): Promise<SpaceNote> {
    try {
      const row = await prisma.spaceNote.upsert({
        where: {
          spaceId_noteId: { spaceId: input.spaceId, noteId: input.noteId },
        },
        create: {
          spaceId: input.spaceId,
          noteId: input.noteId,
          addedBy: DOMAIN_TO_DB[input.addedBy],
          addedAt: input.addedAt,
        },
        update: {
          // Re-adding an already-associated note is a no-op for content;
          // we bump `addedAt` so the most recent action wins ordering.
          addedAt: input.addedAt,
        },
      });
      return toDomain(row);
    } catch (err) {
      logDbFailure({ op: "spaceNote.add", err });
      throw err;
    }
  }

  async remove(spaceId: string, noteId: string): Promise<boolean> {
    try {
      const result = await prisma.spaceNote.deleteMany({
        where: { spaceId, noteId },
      });
      return result.count > 0;
    } catch (err) {
      logDbFailure({ op: "spaceNote.remove", err });
      throw err;
    }
  }

  async listNoteIdsBySpace(input: { spaceId: string; limit: number }): Promise<string[]> {
    const rows = await prisma.spaceNote.findMany({
      where: { spaceId: input.spaceId },
      orderBy: { addedAt: "desc" },
      take: input.limit,
      select: { noteId: true },
    });
    return rows.map((row) => row.noteId);
  }

  async listSpaceIdsByNote(input: { noteId: string; limit: number }): Promise<string[]> {
    const rows = await prisma.spaceNote.findMany({
      where: { noteId: input.noteId },
      orderBy: { addedAt: "desc" },
      take: input.limit,
      select: { spaceId: true },
    });
    return rows.map((row) => row.spaceId);
  }
}
