import type { NextRequest } from "next/server";
import { toErrorResponse } from "@/errors/error-handler";
import {
  createCanvasEdgeBodySchema,
  createCanvasNodeBodySchema,
  patchCanvasNodeLayoutBodySchema,
  patchCanvasViewportBodySchema,
} from "@/schemas/note.schema";
import { getNoteServiceDeps } from "@/services/dependencies";
import {
  addCanvasEdge,
  addCanvasNode,
  getCanvasBundle,
  patchCanvasNodeLayout,
  patchCanvasViewport,
  removeCanvasEdge,
  removeCanvasNode,
} from "@/services/canvas.service";
import type { Canvas, CanvasEdge, CanvasNode, CanvasViewport } from "@/domain/canvas";

function toCanvasDto(canvas: Canvas) {
  return {
    id: canvas.id,
    spaceId: canvas.spaceId,
    name: canvas.name,
    viewport: canvas.viewport,
    createdAt: canvas.createdAt.toISOString(),
    updatedAt: canvas.updatedAt.toISOString(),
  };
}

function toNodeDto(node: CanvasNode) {
  return {
    id: node.id,
    canvasId: node.canvasId,
    type: node.type,
    noteId: node.noteId,
    text: node.text,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    zIndex: node.zIndex,
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString(),
  };
}

function toEdgeDto(edge: CanvasEdge) {
  return {
    id: edge.id,
    canvasId: edge.canvasId,
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    label: edge.label,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    createdAt: edge.createdAt.toISOString(),
    updatedAt: edge.updatedAt.toISOString(),
  };
}

interface RouteParams {
  params: Promise<{ spaceId: string }>;
}

// GET /spaces/:spaceId/canvas → returns the canvas + nodes + edges
export async function GET_CANVAS(_req: NextRequest, ctx: RouteParams): Promise<Response> {
  try {
    const { spaceId } = await ctx.params;
    const deps = getNoteServiceDeps();
    const bundle = await getCanvasBundle(deps, spaceId);
    return Response.json({
      data: {
        canvas: toCanvasDto(bundle.canvas),
        nodes: bundle.nodes.map(toNodeDto),
        edges: bundle.edges.map(toEdgeDto),
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

// PATCH /spaces/:spaceId/canvas/viewport → persist pan/zoom
export async function PATCH_CANVAS_VIEWPORT(
  req: NextRequest,
  ctx: RouteParams,
): Promise<Response> {
  try {
    const { spaceId } = await ctx.params;
    const body = patchCanvasViewportBodySchema.parse(await req.json().catch(() => ({})));
    const viewport: CanvasViewport = { x: body.x, y: body.y, zoom: body.zoom };
    const deps = getNoteServiceDeps();
    await patchCanvasViewport(deps, spaceId, viewport);
    return Response.json({ data: { viewport } });
  } catch (err) {
    return toErrorResponse(err);
  }
}

// POST /spaces/:spaceId/canvas/nodes → add a node
export async function POST_NODE(req: NextRequest, ctx: RouteParams): Promise<Response> {
  try {
    const { spaceId } = await ctx.params;
    const body = createCanvasNodeBodySchema.parse(await req.json().catch(() => ({})));
    const deps = getNoteServiceDeps();
    const node = await addCanvasNode(deps, spaceId, {
      type: body.type,
      noteId: body.noteId ?? null,
      text: body.text ?? null,
      x: body.x,
      y: body.y,
      width: body.width,
      height: body.height,
      zIndex: body.zIndex ?? 0,
    });
    return Response.json({ data: toNodeDto(node) }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

// PATCH /spaces/:spaceId/canvas/nodes/:nodeId → update layout
export async function PATCH_NODE(
  req: NextRequest,
  ctx: RouteParams & { params: Promise<{ spaceId: string; nodeId: string }> },
): Promise<Response> {
  try {
    const { spaceId, nodeId } = await ctx.params;
    const body = patchCanvasNodeLayoutBodySchema.parse(await req.json().catch(() => ({})));
    const deps = getNoteServiceDeps();
    const updated = await patchCanvasNodeLayout(deps, spaceId, nodeId, {
      x: body.x,
      y: body.y,
      width: body.width,
      height: body.height,
      zIndex: body.zIndex,
    });
    return Response.json({ data: toNodeDto(updated) });
  } catch (err) {
    return toErrorResponse(err);
  }
}

// DELETE /spaces/:spaceId/canvas/nodes/:nodeId → remove a node
export async function DELETE_NODE(
  _req: NextRequest,
  ctx: RouteParams & { params: Promise<{ spaceId: string; nodeId: string }> },
): Promise<Response> {
  try {
    const { spaceId, nodeId } = await ctx.params;
    const deps = getNoteServiceDeps();
    await removeCanvasNode(deps, spaceId, nodeId);
    return new Response(null, { status: 204 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

// POST /spaces/:spaceId/canvas/edges → add an edge
export async function POST_EDGE(req: NextRequest, ctx: RouteParams): Promise<Response> {
  try {
    const { spaceId } = await ctx.params;
    const body = createCanvasEdgeBodySchema.parse(await req.json().catch(() => ({})));
    const deps = getNoteServiceDeps();
    const edge = await addCanvasEdge(deps, spaceId, {
      sourceNodeId: body.sourceNodeId,
      targetNodeId: body.targetNodeId,
      label: body.label ?? null,
      sourceHandle: body.sourceHandle ?? null,
      targetHandle: body.targetHandle ?? null,
    });
    return Response.json({ data: toEdgeDto(edge) }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

// DELETE /spaces/:spaceId/canvas/edges/:edgeId → remove an edge
export async function DELETE_EDGE(
  _req: NextRequest,
  ctx: RouteParams & { params: Promise<{ spaceId: string; edgeId: string }> },
): Promise<Response> {
  try {
    const { spaceId, edgeId } = await ctx.params;
    const deps = getNoteServiceDeps();
    await removeCanvasEdge(deps, spaceId, edgeId);
    return new Response(null, { status: 204 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
