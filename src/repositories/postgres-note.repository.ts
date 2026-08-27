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

/** Same rule as `normaliseWhyItMatters` for the optional `reference`
 *  column (v0.8). Empty / whitespace-only inputs collapse to null so
 *  list previews stay clean. */
function normaliseReference(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Parse a JSON column that semantically holds `string[]` (was TEXT[] in
 *  PostgreSQL, now JSON in MariaDB). The driver may give us the parsed
 *  array or the raw JSON string depending on the call path (typed client
 *  vs $queryRaw), so accept both.
 *
 *  Throws on a structural mismatch rather than silently coercing — the
 *  alternative is "tags comes back as [object Object]" bugs that only
 *  surface at runtime. */
function parseJsonStringArray(raw: unknown, fieldName: string): string[] {
  let candidate: unknown = raw;
  if (typeof raw === "string") {
    try {
      candidate = JSON.parse(raw);
    } catch (err) {
      throw new Error(
        `${fieldName}: invalid JSON string "${raw}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  if (candidate === null || candidate === undefined) return [];
  if (!Array.isArray(candidate)) {
    throw new Error(
      `${fieldName}: expected JSON array, got ${typeof candidate}: ${JSON.stringify(candidate)}`,
    );
  }
  return candidate.map((value, index) => {
    if (typeof value !== "string") {
      throw new Error(
        `${fieldName}[${index}]: expected string, got ${typeof value}: ${JSON.stringify(value)}`,
      );
    }
    return value;
  });
}

/** Wrap a string array for the `Json` column. The cast is safe because
 *  `JsonArray` is just `InputJsonValue[]` and a `string[]` is assignable
 *  when every element is a JSON-compatible primitive. */
function toJsonStringArray(arr: readonly string[]): Prisma.InputJsonValue {
  return arr.slice() as unknown as Prisma.InputJsonValue;
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
 *
 * Notes on the MariaDB / JSON adaptation:
 * - `row.linkedNoteIds` and `row.tags` come back from Prisma as
 *   `Prisma.JsonValue` (they were `string[]` in the PostgreSQL version).
 *   We parse them here into the domain `string[]` shape so the rest of
 *   the app — and the in-memory repo — keeps treating them as plain
 *   arrays. `parseJsonStringArray` is defensive about both parsed and
 *   stringified inputs because $queryRaw paths return raw strings.
 */
function toDomain(row: PrismaNote): Note {
  return {
    id: row.id,
    publicId: row.publicId,
    content: row.content,
    whyItMatters: row.whyItMatters ?? null,
    reference: row.reference ?? null,
    status: row.status,
    linkedNoteIds: parseJsonStringArray(row.linkedNoteIds, "linkedNoteIds"),
    tags: parseJsonStringArray(row.tags, "tags"),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    processedAt: row.processedAt,
    lastReviewedAt: row.lastReviewedAt,
    nextReviewAt: row.nextReviewAt,
    reviewCount: row.reviewCount,
    deletedAt: row.deletedAt,
  };
}

/** Snake-case row shape returned by $queryRaw for the `findBacklinks`
 *  query. Mirrors the columns of the `notes` table. */
interface RawNoteRow {
  id: string;
  public_id: string;
  content: string;
  why_it_matters: string | null;
  reference: string | null;
  status: NoteStatus;
  linked_note_ids: unknown;
  tags: unknown;
  created_at: Date;
  updated_at: Date;
  processed_at: Date | null;
  last_reviewed_at: Date | null;
  next_review_at: Date | null;
  review_count: number;
  deleted_at: Date | null;
}

/** Same as `toDomain` but reads from snake_case columns, the shape we
 *  get back from `$queryRaw`. */
function toDomainFromRaw(row: RawNoteRow): Note {
  return {
    id: row.id,
    publicId: row.public_id,
    content: row.content,
    whyItMatters: row.why_it_matters,
    reference: row.reference,
    status: row.status,
    linkedNoteIds: parseJsonStringArray(row.linked_note_ids, "linked_note_ids"),
    tags: parseJsonStringArray(row.tags, "tags"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    processedAt: row.processed_at,
    lastReviewedAt: row.last_reviewed_at,
    nextReviewAt: row.next_review_at,
    reviewCount: row.review_count,
    deletedAt: row.deleted_at,
  };
}

export class PostgresNoteRepository implements NoteRepository {
  async insert(input: {
    publicId: string;
    content: string;
    whyItMatters?: string | null;
    reference?: string | null;
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
          reference: normaliseReference(input.reference),
          linkedNoteIds: toJsonStringArray(input.linkedNoteIds),
          tags: toJsonStringArray(input.tags),
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
      data.tags = toJsonStringArray(patch.tags);
    }
    if (patch.content !== undefined && patch.linkedNoteIds !== undefined) {
      data.linkedNoteIds = toJsonStringArray(patch.linkedNoteIds);
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
        data: {
          content,
          linkedNoteIds: toJsonStringArray(linkedNoteIds),
          status: toStatus,
          updatedAt,
        },
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
    // `tag` requires JSON_CONTAINS on the MariaDB JSON column; Prisma's
    // typed `findMany` can't express that (no `has` operator on JSON).
    // When tag is set we drop to $queryRaw. The non-tag path keeps the
    // typed query so the rest of the filter logic stays simple.
    if (input.tag) {
      const conditions: Prisma.Sql[] = [Prisma.sql`deleted_at IS NULL`];
      if (input.q) {
        // MariaDB's default utf8mb4_unicode_ci collation makes LIKE
        // case-insensitive, so no ESCAPE or LOWER() wrapping needed.
        conditions.push(Prisma.sql`content LIKE ${`%${input.q}%`}`);
      }
      if (input.status) {
        conditions.push(Prisma.sql`status = ${input.status}`);
      }
      // JSON_CONTAINS expects a JSON-encoded value as the second arg.
      conditions.push(
        Prisma.sql`JSON_CONTAINS(tags, ${JSON.stringify([input.tag])})`,
      );
      const rows = await prisma.$queryRaw<RawNoteRow[]>(Prisma.sql`
        SELECT id, public_id, content, why_it_matters, reference, status,
               linked_note_ids, tags,
               created_at, updated_at, processed_at, last_reviewed_at,
               next_review_at, review_count, deleted_at
        FROM notes
        WHERE ${Prisma.join(conditions, " AND ")}
        ORDER BY created_at DESC
        LIMIT ${input.limit}
      `);
      return rows.map(toDomainFromRaw);
    }

    const where: PrismaNS.NoteWhereInput = { deletedAt: null };
    if (input.q) {
      // MariaDB's default utf8mb4_unicode_ci collation makes LIKE
      // case-insensitive; Prisma's typed `contains` filter compiles to
      // LIKE under the hood, so the match is case-insensitive here too.
      where.content = { contains: input.q };
    }
    if (input.status) {
      where.status = input.status;
    }
    const rows = await prisma.note.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.limit,
    });
    return rows.map(toDomain);
  }

  async findBacklinks(targetPublicId: string, limit: number): Promise<Note[]> {
    // JSON_CONTAINS on the MariaDB JSON column. Same reason as the tag
    // path in `listWithFilters`: Prisma's typed query has no `has`
    // operator against JSON columns.
    const rows = await prisma.$queryRaw<RawNoteRow[]>`
      SELECT id, public_id, content, why_it_matters, reference, status,
             linked_note_ids, tags,
             created_at, updated_at, processed_at, last_reviewed_at,
             next_review_at, review_count, deleted_at
      FROM notes
      WHERE deleted_at IS NULL
        AND JSON_CONTAINS(linked_note_ids, ${JSON.stringify([targetPublicId])})
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return rows.map(toDomainFromRaw);
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
    reference: string | null;
    processedAt: Date;
    lastReviewedAt: Date;
    updatedAt: Date;
  }): Promise<Note | null> {
    try {
      const row = await prisma.note.update({
        where: { id: input.id, deletedAt: null, status: "inbox" },
        data: {
          content: input.content,
          linkedNoteIds: toJsonStringArray(input.linkedNoteIds),
          whyItMatters: input.whyItMatters,
          reference: input.reference,
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
