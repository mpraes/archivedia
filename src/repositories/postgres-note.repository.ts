import { Prisma, type Note as PrismaNote } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Note } from "@/domain/note";
import type { NoteStatus } from "@/domain/note-status";
import { NoteNotProcessable, type NoteRepository } from "./note.repository";

/**
 * Postgres-backed implementation of NoteRepository. Maps Prisma's row
 * shape (snake_case columns, Date objects) to the domain Note so the
 * rest of the app never imports @prisma/client directly.
 */
function toDomain(row: PrismaNote): Note {
  return {
    id: row.id,
    publicId: row.publicId,
    content: row.content,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export class PostgresNoteRepository implements NoteRepository {
  async insert(input: { publicId: string; content: string; createdAt: Date }): Promise<Note> {
    const row = await prisma.note.create({
      data: {
        publicId: input.publicId,
        content: input.content,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
      },
    });
    return toDomain(row);
  }

  async findActiveById(id: string): Promise<Note | null> {
    const row = await prisma.note.findFirst({
      where: { id, deletedAt: null },
    });
    return row ? toDomain(row) : null;
  }

  async listByDay(start: Date, end: Date, limit: number): Promise<Note[]> {
    const rows = await prisma.note.findMany({
      where: { deletedAt: null, createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(toDomain);
  }

  async updateContent(id: string, content: string, updatedAt: Date): Promise<Note> {
    try {
      const row = await prisma.note.update({
        where: { id, deletedAt: null },
        data: { content, updatedAt },
      });
      return toDomain(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new Error("NOTE_GONE");
      }
      throw err;
    }
  }

  async softDelete(id: string, deletedAt: Date): Promise<boolean> {
    const result = await prisma.note.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt },
    });
    return result.count > 0;
  }

  async countByPublicIdPrefix(prefix: string): Promise<number> {
    return prisma.note.count({
      where: { publicId: { startsWith: prefix } },
    });
  }

  async findActiveByContentInBucketPrefix(
    content: string,
    bucketPrefix: string,
  ): Promise<Note | null> {
    const row = await prisma.note.findFirst({
      where: {
        content,
        publicId: { startsWith: bucketPrefix },
        deletedAt: null,
      },
    });
    return row ? toDomain(row) : null;
  }

  async updateContentAndStatus(
    id: string,
    content: string,
    updatedAt: Date,
    fromStatus: NoteStatus,
    toStatus: NoteStatus,
  ): Promise<Note | null> {
    try {
      const row = await prisma.note.update({
        where: { id, deletedAt: null, status: fromStatus },
        data: { content, status: toStatus, updatedAt },
      });
      return toDomain(row);
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2025") {
        throw err;
      }
      // P2025: row didn't match the where clause. Distinguish "missing/deleted"
      // from "wrong status" so callers can return 404 vs 409.
      const existing = await prisma.note.findUnique({
        where: { id },
        select: { status: true, deletedAt: true },
      });
      if (!existing || existing.deletedAt !== null) return null;
      throw new NoteNotProcessable(existing.status);
    }
  }
}
