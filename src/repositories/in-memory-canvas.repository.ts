import type {
  Canvas,
  CanvasEdge,
  CanvasNode,
  CanvasViewport,
} from "@/domain/canvas";
import type {
  CanvasEdgeInsert,
  CanvasNodeInsert,
  CanvasNodeLayoutPatch,
  CanvasRepository,
} from "./canvas.repository";

/**
 * In-memory fake for the Canvas aggregate. Keeps the Canvas + its
 * nodes + edges in one in-memory structure so test cases can drive
 * the full canvas lifecycle without spinning up Postgres.
 */
export class InMemoryCanvasRepository implements CanvasRepository {
  private canvases = new Map<string, Canvas>();
  private nodes = new Map<string, CanvasNode>();
  private edges = new Map<string, CanvasEdge>();
  private counter = 0;

  private nextId(): string {
    this.counter += 1;
    return `00000000-0000-0000-0000-${String(this.counter).padStart(12, "0")}`;
  }

  async findBySpaceId(spaceId: string): Promise<Canvas | null> {
    for (const canvas of this.canvases.values()) {
      if (canvas.spaceId === spaceId) return canvas;
    }
    return null;
  }

  async getOrCreateForSpace(input: { spaceId: string; now: Date }): Promise<Canvas> {
    const existing = await this.findBySpaceId(input.spaceId);
    if (existing) return existing;
    const canvas: Canvas = {
      id: this.nextId(),
      spaceId: input.spaceId,
      name: "Main canvas",
      viewport: { x: 0, y: 0, zoom: 1 },
      createdAt: input.now,
      updatedAt: input.now,
    };
    this.canvases.set(canvas.id, canvas);
    return canvas;
  }

  async patchViewport(canvasId: string, viewport: CanvasViewport, updatedAt: Date): Promise<void> {
    const current = this.canvases.get(canvasId);
    if (!current) return;
    this.canvases.set(canvasId, { ...current, viewport, updatedAt });
  }

  async listNodes(canvasId: string): Promise<CanvasNode[]> {
    return [...this.nodes.values()]
      .filter((n) => n.canvasId === canvasId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async insertNode(canvasId: string, insert: CanvasNodeInsert, now: Date): Promise<CanvasNode> {
    const id = this.nextId();
    const node: CanvasNode = {
      id,
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
    };
    this.nodes.set(id, node);
    return node;
  }

  async patchNodeLayout(
    canvasId: string,
    nodeId: string,
    patch: CanvasNodeLayoutPatch,
    updatedAt: Date,
  ): Promise<CanvasNode | null> {
    const current = this.nodes.get(nodeId);
    if (!current || current.canvasId !== canvasId) return null;
    const next: CanvasNode = {
      ...current,
      x: patch.x ?? current.x,
      y: patch.y ?? current.y,
      width: patch.width ?? current.width,
      height: patch.height ?? current.height,
      zIndex: patch.zIndex ?? current.zIndex,
      updatedAt,
    };
    this.nodes.set(nodeId, next);
    return next;
  }

  async removeNode(canvasId: string, nodeId: string): Promise<boolean> {
    const current = this.nodes.get(nodeId);
    if (!current || current.canvasId !== canvasId) return false;
    this.nodes.delete(nodeId);
    // Cascade: drop any edges that referenced this node.
    for (const edge of [...this.edges.values()]) {
      if (edge.sourceNodeId === nodeId || edge.targetNodeId === nodeId) {
        this.edges.delete(edge.id);
      }
    }
    return true;
  }

  async listEdges(canvasId: string): Promise<CanvasEdge[]> {
    return [...this.edges.values()]
      .filter((e) => e.canvasId === canvasId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async insertEdge(canvasId: string, insert: CanvasEdgeInsert, now: Date): Promise<CanvasEdge> {
    const id = this.nextId();
    const edge: CanvasEdge = {
      id,
      canvasId,
      sourceNodeId: insert.sourceNodeId,
      targetNodeId: insert.targetNodeId,
      label: insert.label ?? null,
      sourceHandle: insert.sourceHandle ?? null,
      targetHandle: insert.targetHandle ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.edges.set(id, edge);
    return edge;
  }

  async removeEdge(canvasId: string, edgeId: string): Promise<boolean> {
    const current = this.edges.get(edgeId);
    if (!current || current.canvasId !== canvasId) return false;
    this.edges.delete(edgeId);
    return true;
  }
}
