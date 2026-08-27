import type { Space as PrismaSpace, SpaceStatus as PrismaSpaceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logDbFailure } from "@/lib/logger";
import type { Space, SpaceStatus } from "@/domain/space";
import type { SpacePatch, SpaceRepository } from "./space.repository";

function toDomain(row: PrismaSpace): Space {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normaliseDescription(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export class PostgresSpaceRepository implements SpaceRepository {
  async insert(input: {
    title: string;
    description: string | null;
    now: Date;
  }): Promise<Space> {
    try {
      const row = await prisma.space.create({
        data: {
          title: input.title.trim(),
          description: normaliseDescription(input.description),
          createdAt: input.now,
          updatedAt: input.now,
        },
      });
      return toDomain(row);
    } catch (err) {
      logDbFailure({ op: "space.insert", err });
      throw err;
    }
  }

  async findById(id: string): Promise<Space | null> {
    const row = await prisma.space.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async list(input: { includeArchived: boolean; limit: number }): Promise<Space[]> {
    const rows = await prisma.space.findMany({
      where: input.includeArchived ? undefined : { status: { not: "archived" } },
      orderBy: { updatedAt: "desc" },
      take: input.limit,
    });
    return rows.map(toDomain);
  }

  async countByStatus(): Promise<Record<SpaceStatus, number>> {
    const rows = await prisma.space.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const initial: Record<SpaceStatus, number> = {
      active: 0,
      completed: 0,
      archived: 0,
    };
    for (const row of rows) {
      const status = row.status as PrismaSpaceStatus;
      initial[status] = row._count._all;
    }
    return initial;
  }

  async countNotes(spaceId: string): Promise<number> {
    return prisma.spaceNote.count({ where: { spaceId } });
  }

  async patch(id: string, patch: SpacePatch, updatedAt: Date): Promise<Space | null> {
    const data: Partial<PrismaSpace> = { updatedAt };
    if (patch.title !== undefined) {
      const trimmed = patch.title.trim();
      if (trimmed.length === 0) {
        throw new Error("SPACE_TITLE_EMPTY");
      }
      data.title = trimmed;
    }
    if (patch.description !== undefined) {
      data.description = normaliseDescription(patch.description);
    }
    if (patch.status !== undefined) {
      data.status = patch.status;
    }
    try {
      const row = await prisma.space.update({ where: { id }, data });
      return toDomain(row);
    } catch (err) {
      logDbFailure({ op: "space.patch", err, spaceId: id });
      throw err;
    }
  }
}
