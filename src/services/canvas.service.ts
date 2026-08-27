import type {
  Canvas,
  CanvasEdge,
  CanvasNode,
  CanvasViewport,
} from "@/domain/canvas";
import { AppError } from "@/errors/app-error";
import { logDbFailure } from "@/lib/logger";
import type {
  CanvasEdgeInsert,
  CanvasNodeInsert,
  CanvasNodeLayoutPatch,
  CanvasRepository,
} from "@/repositories/canvas.repository";
import type { NoteRepository } from "@/repositories/note.repository";
import type { SpaceRepository } from "@/repositories/space.repository";

/**
 * Service layer for the Canvas aggregate. Lives in one file because
 * Canvas operations always touch the nodes + edges + canvas rows
 * together; splitting them would force callers to know the internals.
 *
 * Errors:
 * - Space not found → AppError.notFound (404)
 * - Note not found / soft-deleted → AppError.notFound (404)
 * - Node not in the Canvas → AppError.notFound (404)
 * - Edge endpoints must exist in the same Canvas, must not self-loop,
 *   label length capped at 64 chars
 * - text/noteId XOR validation per CanvasNode.type
 */
export interface CanvasServiceDeps {
  repository: NoteRepository;
  spaceRepository: SpaceRepository;
  canvasRepository: CanvasRepository;
}

export interface CanvasBundle {
  canvas: Canvas;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export async function getOrCreateCanvasForSpace(
  deps: CanvasServiceDeps,
  spaceId: string,
  now: Date = new Date(),
): Promise<Canvas> {
  const space = await deps.spaceRepository.findById(spaceId);
  if (!space) throw AppError.notFound();
  try {
    return await deps.canvasRepository.getOrCreateForSpace({ spaceId, now });
  } catch (err) {
    logDbFailure({ component: "canvas", op: "getOrCreate", err, spaceId });
    throw AppError.databaseUnavailable();
  }
}

export async function getCanvasBundle(
  deps: CanvasServiceDeps,
  spaceId: string,
): Promise<CanvasBundle> {
  const canvas = await getOrCreateCanvasForSpace(deps, spaceId);
  const [nodes, edges] = await Promise.all([
    deps.canvasRepository.listNodes(canvas.id),
    deps.canvasRepository.listEdges(canvas.id),
  ]);
  return { canvas, nodes, edges };
}

export async function patchCanvasViewport(
  deps: CanvasServiceDeps,
  spaceId: string,
  viewport: CanvasViewport,
  now: Date = new Date(),
): Promise<void> {
  const canvas = await getOrCreateCanvasForSpace(deps, spaceId, now);
  try {
    await deps.canvasRepository.patchViewport(canvas.id, viewport, now);
  } catch (err) {
    logDbFailure({ component: "canvas", op: "patchViewport", err, spaceId });
    throw AppError.databaseUnavailable();
  }
}

export async function addCanvasNode(
  deps: CanvasServiceDeps,
  spaceId: string,
  insert: CanvasNodeInsert,
  now: Date = new Date(),
): Promise<CanvasNode> {
  const canvas = await getOrCreateCanvasForSpace(deps, spaceId, now);
  // Validate the note/text XOR invariant before hitting the DB.
  if (insert.type === "note") {
    if (!insert.noteId) {
      throw AppError.validation(
        { noteId: "noteId is required for a note card." },
        "Missing noteId.",
      );
    }
    const note = await deps.repository.findActiveById(insert.noteId);
    if (!note) throw AppError.notFound();
  } else if (insert.type === "text") {
    if (!insert.text || insert.text.trim().length === 0) {
      throw AppError.validation(
        { text: "text is required for a text card." },
        "Empty text card.",
      );
    }
  }
  try {
    return await deps.canvasRepository.insertNode(canvas.id, normalisedNodeInsert(insert), now);
  } catch (err) {
    logDbFailure({ component: "canvas", op: "addNode", err, spaceId });
    throw AppError.databaseUnavailable();
  }
}

export async function patchCanvasNodeLayout(
  deps: CanvasServiceDeps,
  spaceId: string,
  nodeId: string,
  patch: CanvasNodeLayoutPatch,
  now: Date = new Date(),
): Promise<CanvasNode> {
  const canvas = await getOrCreateCanvasForSpace(deps, spaceId, now);
  const updated = await deps.canvasRepository.patchNodeLayout(canvas.id, nodeId, patch, now);
  if (!updated) throw AppError.notFound();
  return updated;
}

export async function removeCanvasNode(
  deps: CanvasServiceDeps,
  spaceId: string,
  nodeId: string,
): Promise<void> {
  const canvas = await getOrCreateCanvasForSpace(deps, spaceId);
  const removed = await deps.canvasRepository.removeNode(canvas.id, nodeId);
  if (!removed) throw AppError.notFound();
}

export async function addCanvasEdge(
  deps: CanvasServiceDeps,
  spaceId: string,
  insert: CanvasEdgeInsert,
  now: Date = new Date(),
): Promise<CanvasEdge> {
  if (insert.sourceNodeId === insert.targetNodeId) {
    throw AppError.validation(
      { sourceNodeId: "source and target must differ." },
      "Self-loop edges are not allowed.",
    );
  }
  if (insert.label && insert.label.length > 64) {
    throw AppError.validation({ label: "label must be 64 chars or fewer." });
  }
  const canvas = await getOrCreateCanvasForSpace(deps, spaceId, now);
  // Verify both endpoints live on this canvas; otherwise the edge
  // would point into nothing.
  const nodes = await deps.canvasRepository.listNodes(canvas.id);
  const ids = new Set(nodes.map((n) => n.id));
  if (!ids.has(insert.sourceNodeId) || !ids.has(insert.targetNodeId)) {
    throw AppError.validation(
      { edges: "Both endpoints must exist in this Canvas." },
      "Edge endpoints not found in canvas.",
    );
  }
  try {
    return await deps.canvasRepository.insertEdge(canvas.id, insert, now);
  } catch (err) {
    logDbFailure({ component: "canvas", op: "addEdge", err, spaceId });
    throw AppError.databaseUnavailable();
  }
}

export async function removeCanvasEdge(
  deps: CanvasServiceDeps,
  spaceId: string,
  edgeId: string,
): Promise<void> {
  const canvas = await getOrCreateCanvasForSpace(deps, spaceId);
  const removed = await deps.canvasRepository.removeEdge(canvas.id, edgeId);
  if (!removed) throw AppError.notFound();
}

function normalisedNodeInsert(insert: CanvasNodeInsert): CanvasNodeInsert {
  // Trim whitespace on text cards; null out the unused field per type.
  if (insert.type === "text") {
    return { ...insert, text: (insert.text ?? "").trim(), noteId: null };
  }
  return { ...insert, text: null };
}
