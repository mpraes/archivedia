import { Prisma, type Canvas as PrismaCanvas } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logDbFailure } from "@/lib/logger";
import type {
  Canvas,
  CanvasEdge,
  CanvasHandle,
  CanvasNode,
  CanvasNodeType,
  CanvasViewport,
} from "@/domain/canvas";
import type {
  CanvasEdgeInsert,
  CanvasNodeInsert,
  CanvasNodeLayoutPatch,
  CanvasRepository,
} from "./canvas.repository";

const DEFAULT_VIEWPORT: CanvasViewport = { x: 0, y: 0, zoom: 1 };

function viewportFromJson(raw: unknown): CanvasViewport {
  if (!raw || typeof raw !== "object") return DEFAULT_VIEWPORT;
  const candidate = raw as Partial<CanvasViewport>;
  return {
    x: typeof candidate.x === "number" ? candidate.x : 0,
    y: typeof candidate.y === "number" ? candidate.y : 0,
    zoom: typeof candidate.zoom === "number" ? candidate.zoom : 1,
  };
}

function viewportToJson(viewport: CanvasViewport): Prisma.InputJsonValue {
  return { x: viewport.x, y: viewport.y, zoom: viewport.zoom };
}

function canvasToDomain(row: PrismaCanvas): Canvas {
  return {
    id: row.id,
    spaceId: row.spaceId,
    name: row.name,
    viewport: viewportFromJson(row.viewport),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function nodeToDomain(row: {
  id: string;
  canvasId: string;
  type: CanvasNodeType;
  noteId: string | null;
  text: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  createdAt: Date;
  updatedAt: Date;
}): CanvasNode {
  return { ...row };
}

function edgeToDomain(row: {
  id: string;
  canvasId: string;
  sourceNodeId: string;
  targetNodeId: string;
  label: string | null;
  sourceHandle: CanvasHandle | null;
  targetHandle: CanvasHandle | null;
  createdAt: Date;
  updatedAt: Date;
}): CanvasEdge {
  return { ...row };
}

export class PostgresCanvasRepository implements CanvasRepository {
  async findBySpaceId(spaceId: string): Promise<Canvas | null> {
    const row = await prisma.canvas.findUnique({ where: { spaceId } });
    return row ? canvasToDomain(row) : null;
  }

  async getOrCreateForSpace(input: { spaceId: string; now: Date }): Promise<Canvas> {
    const existing = await prisma.canvas.findUnique({ where: { spaceId: input.spaceId } });
    if (existing) return canvasToDomain(existing);
    try {
      const created = await prisma.canvas.create({
        data: {
          spaceId: input.spaceId,
          name: "Main canvas",
          viewport: viewportToJson(DEFAULT_VIEWPORT),
          createdAt: input.now,
          updatedAt: input.now,
        },
      });
      return canvasToDomain(created);
    } catch (err) {
      // Two concurrent creates: one of them will hit the unique index.
      // Re-read the winner and return it.
      logDbFailure({ op: "canvas.getOrCreate", err, spaceId: input.spaceId });
      const winner = await prisma.canvas.findUnique({ where: { spaceId: input.spaceId } });
      if (winner) return canvasToDomain(winner);
      throw err;
    }
  }

  async patchViewport(canvasId: string, viewport: CanvasViewport, updatedAt: Date): Promise<void> {
    try {
      await prisma.canvas.update({
        where: { id: canvasId },
        data: { viewport: viewportToJson(viewport), updatedAt },
      });
    } catch (err) {
      logDbFailure({ op: "canvas.patchViewport", err, canvasId });
      throw err;
    }
  }

  async listNodes(canvasId: string): Promise<CanvasNode[]> {
    const rows = await prisma.canvasNode.findMany({
      where: { canvasId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(nodeToDomain);
  }

  async insertNode(canvasId: string, insert: CanvasNodeInsert, now: Date): Promise<CanvasNode> {
    const row = await prisma.canvasNode.create({
      data: {
        canvasId,
        type: insert.type,
        noteId: insert.noteId ?? null,
        text: insert.text ?? null,
        x: insert.x,
        y: insert.y,
        width: insert.width,
        height: insert.height,
        zIndex: insert.zIndex,
        createdAt: now,
        updatedAt: now,
      },
    });
    return nodeToDomain(row);
  }

  async patchNodeLayout(
    canvasId: string,
    nodeId: string,
    patch: CanvasNodeLayoutPatch,
    updatedAt: Date,
  ): Promise<CanvasNode | null> {
    try {
      const row = await prisma.canvasNode.update({
        where: { id: nodeId, canvasId },
        data: { ...patch, updatedAt },
      });
      return nodeToDomain(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        return null;
      }
      logDbFailure({ op: "canvas.patchNodeLayout", err, canvasId, nodeId });
      throw err;
    }
  }

  async removeNode(canvasId: string, nodeId: string): Promise<boolean> {
    const result = await prisma.canvasNode.deleteMany({ where: { id: nodeId, canvasId } });
    return result.count > 0;
  }

  async listEdges(canvasId: string): Promise<CanvasEdge[]> {
    const rows = await prisma.canvasEdge.findMany({
      where: { canvasId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(edgeToDomain);
  }

  async insertEdge(canvasId: string, insert: CanvasEdgeInsert, now: Date): Promise<CanvasEdge> {
    const row = await prisma.canvasEdge.create({
      data: {
        canvasId,
        sourceNodeId: insert.sourceNodeId,
        targetNodeId: insert.targetNodeId,
        label: insert.label ?? null,
        sourceHandle: insert.sourceHandle ?? null,
        targetHandle: insert.targetHandle ?? null,
        createdAt: now,
        updatedAt: now,
      },
    });
    return edgeToDomain(row);
  }

  async removeEdge(canvasId: string, edgeId: string): Promise<boolean> {
    const result = await prisma.canvasEdge.deleteMany({ where: { id: edgeId, canvasId } });
    return result.count > 0;
  }
}
