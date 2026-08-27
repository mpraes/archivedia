import { Prisma, Prisma as PrismaNS, type Note as PrismaNote } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logDbFailure } from "@/lib/logger";
import { reviewGate } from "@/lib/format";
import type { Note } from "@/domain/note";
import type { NoteStatus } from "@/domain/note-status";
import { NoteNotProcessable, type NotePatch, type NoteRepository } from "./note.repository";

/** Trim whitespace; treat empty strings as "no answer". Keeps null as
 *  null so existing rows stay untouched by accidental empty strings. */
function normaliseWhyItMatters(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Shared WHERE clause for review-queue queries. Mirrors the
 *  `requiresReview()` predicate in lib/format.ts so DB-side filtering
 *  and JS-side filtering agree on the rule. */
function reviewWhere(now: Date): PrismaNS.NoteWhereInput {
  const gate = reviewGate(now);
  return {
    deletedAt: null,
    status: "inbox",
    createdAt: { lte: gate.earliestCreatedAt },
    OR: [{ nextReviewAt: null }, { nextReviewAt: { lte: now } }],
  };
}

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
    whyItMatters: row.whyItMatters ?? null,
    status: row.status,
    linkedNoteIds: row.linkedNoteIds,
    tags: row.tags,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    processedAt: row.processedAt,
    lastReviewedAt: row.lastReviewedAt,
    nextReviewAt: row.nextReviewAt,
    reviewCount: row.reviewCount,
    deletedAt: row.deletedAt,
  };
}

export class PostgresNoteRepository implements NoteRepository {
  async insert(input: {
    publicId: string;
    content: string;
    whyItMatters?: string | null;
    linkedNoteIds: string[];
    tags: string[];
    createdAt: Date;
  }): Promise<Note> {
    try {
      const row = await prisma.note.create({
        data: {
          publicId: input.publicId,
          content: input.content,
          whyItMatters: normaliseWhyItMatters(input.whyItMatters),
          linkedNoteIds: input.linkedNoteIds,
          tags: input.tags,
          createdAt: input.createdAt,
          updatedAt: input.createdAt,
        },
      });
      return toDomain(row);
    } catch (err) {
      logDbFailure({ op: "insert", err, publicId: input.publicId });
      throw err;
    }
  }

  async findActiveById(id: string): Promise<Note | null> {
    const row = await prisma.note.findFirst({
      where: { id, deletedAt: null },
    });
    return row ? toDomain(row) : null;
  }

  async findActiveByPublicId(publicId: string): Promise<Note | null> {
    const row = await prisma.note.findFirst({
      where: { publicId, deletedAt: null },
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

  async softDelete(id: string, deletedAt: Date): Promise<boolean> {
    // Flip both columns atomically: the timestamp hides the row from
    // listing queries, and the status enum value makes the soft-delete
    // legible to clients without a join on `deleted_at`.
    const result = await prisma.note.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt, status: "deleted" },
    });
    return result.count > 0;
  }

  async patchNote(id: string, patch: NotePatch, updatedAt: Date): Promise<Note | null> {
    const data: Prisma.NoteUpdateInput = { updatedAt };
    if (patch.content !== undefined) {
      data.content = patch.content;
    }
    if (patch.tags !== undefined) {
      data.tags = patch.tags;
    }
    if (patch.content !== undefined && patch.linkedNoteIds !== undefined) {
      data.linkedNoteIds = patch.linkedNoteIds;
    }
    try {
      const row = await prisma.note.update({
        where: { id, deletedAt: null },
        data,
      });
      return toDomain(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return null;
      }
      logDbFailure({ op: "patchNote", err, noteId: id });
      throw err;
    }
  }

  async updateContentAndStatus(
    id: string,
    content: string,
    linkedNoteIds: string[],
    updatedAt: Date,
    fromStatus: NoteStatus,
    toStatus: NoteStatus,
  ): Promise<Note | null> {
    try {
      const row = await prisma.note.update({
        where: { id, deletedAt: null, status: fromStatus },
        data: { content, linkedNoteIds, status: toStatus, updatedAt },
      });
      return toDomain(row);
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2025") {
        logDbFailure({ op: "updateContentAndStatus", err, noteId: id });
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

  async listWithFilters(input: {
    q?: string;
    status?: NoteStatus;
    tag?: string;
    limit: number;
  }): Promise<Note[]> {
    const where: PrismaNS.NoteWhereInput = { deletedAt: null };
    if (input.q) {
      where.content = { contains: input.q, mode: "insensitive" };
    }
    if (input.status) {
      where.status = input.status;
    }
    if (input.tag) {
      where.tags = { has: input.tag };
    }
    const rows = await prisma.note.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.limit,
    });
    return rows.map(toDomain);
  }

  async findBacklinks(targetPublicId: string, limit: number): Promise<Note[]> {
    const rows = await prisma.note.findMany({
      where: { deletedAt: null, linkedNoteIds: { has: targetPublicId } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(toDomain);
  }

  async listReviewQueue(input: { limit: number; now: Date }): Promise<Note[]> {
    const rows = await prisma.note.findMany({
      where: reviewWhere(input.now),
      // Oldest first so the most overdue note comes up first.
      orderBy: { createdAt: "asc" },
      take: input.limit,
    });
    return rows.map(toDomain);
  }

  async countReviewQueue(now: Date): Promise<number> {
    return prisma.note.count({ where: reviewWhere(now) });
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
    try {
      const row = await prisma.note.update({
        where: { id: input.id, deletedAt: null, status: "inbox" },
        data: {
          content: input.content,
          linkedNoteIds: input.linkedNoteIds,
          whyItMatters: input.whyItMatters,
          status: "permanent",
          processedAt: input.processedAt,
          lastReviewedAt: input.lastReviewedAt,
          updatedAt: input.updatedAt,
          reviewCount: { increment: 1 },
        },
      });
      return toDomain(row);
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2025") {
        logDbFailure({ op: "promoteToPermanent", err, noteId: input.id });
        throw err;
      }
      // Same 404/409 split as updateContentAndStatus.
      const existing = await prisma.note.findUnique({
        where: { id: input.id },
        select: { status: true, deletedAt: true },
      });
      if (!existing || existing.deletedAt !== null) return null;
      throw new NoteNotProcessable(existing.status);
    }
  }

  async deferReview(input: {
    id: string;
    nextReviewAt: Date;
    lastReviewedAt: Date;
    updatedAt: Date;
  }): Promise<Note | null> {
    try {
      const row = await prisma.note.update({
        where: { id: input.id, deletedAt: null, status: "inbox" },
        data: {
          nextReviewAt: input.nextReviewAt,
          lastReviewedAt: input.lastReviewedAt,
          updatedAt: input.updatedAt,
          reviewCount: { increment: 1 },
        },
      });
      return toDomain(row);
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2025") {
        logDbFailure({ op: "deferReview", err, noteId: input.id });
        throw err;
      }
      const existing = await prisma.note.findUnique({
        where: { id: input.id },
        select: { status: true, deletedAt: true },
      });
      if (!existing || existing.deletedAt !== null) return null;
      throw new NoteNotProcessable(existing.status);
    }
  }
}
