import type {
  Canvas,
  CanvasEdge,
  CanvasHandle,
  CanvasNode,
  CanvasNodeType,
  CanvasViewport,
} from "@/domain/canvas";

/**
 * Patch shape for the canvas-level viewport (pan/zoom). Sent on the
 * drag-end of the canvas viewport so we don't write per-frame.
 */
export interface CanvasViewportPatch {
  viewport: CanvasViewport;
}

/**
 * Insert payload for a new CanvasNode. The service layer validates
 * that `noteId` and `text` line up with `type` (mutually exclusive).
 */
export interface CanvasNodeInsert {
  type: CanvasNodeType;
  noteId?: string | null;
  text?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

/**
 * Patch shape for node layout updates. Position + size changes are
 * debounced client-side and sent as a single patch at drag-end (per
 * requirements_v2 §"Atualizar layout de cartão"). `zIndex` is bumped
 * when the user brings a card to front.
 */
export interface CanvasNodeLayoutPatch {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  zIndex?: number;
}

/**
 * Insert payload for a new CanvasEdge. Validation (endpoints exist,
 * not self-loop, label length) lives in the service layer.
 */
export interface CanvasEdgeInsert {
  sourceNodeId: string;
  targetNodeId: string;
  label?: string | null;
  sourceHandle?: CanvasHandle | null;
  targetHandle?: CanvasHandle | null;
}

/**
 * Repository contract for the Canvas aggregate (canvas + nodes + edges).
 * Phase 3 ships exactly one Canvas per Space; the service layer is
 * responsible for creating that Canvas lazily on first access.
 */
export interface CanvasRepository {
  /** Returns the Canvas for the Space, or null if it does not exist. */
  findBySpaceId(spaceId: string): Promise<Canvas | null>;
  /**
   * Returns the Canvas for the Space, creating it with default
   * viewport if missing. The single write happens inside a transaction
   * so two concurrent requests can't both win the create.
   */
  getOrCreateForSpace(input: {
    spaceId: string;
    now: Date;
  }): Promise<Canvas>;
  /** Replace the persisted viewport for a Canvas. */
  patchViewport(canvasId: string, viewport: CanvasViewport, updatedAt: Date): Promise<void>;

  // ---- nodes ----
  listNodes(canvasId: string): Promise<CanvasNode[]>;
  insertNode(canvasId: string, insert: CanvasNodeInsert, now: Date): Promise<CanvasNode>;
  patchNodeLayout(
    canvasId: string,
    nodeId: string,
    patch: CanvasNodeLayoutPatch,
    updatedAt: Date,
  ): Promise<CanvasNode | null>;
  removeNode(canvasId: string, nodeId: string): Promise<boolean>;

  // ---- edges ----
  listEdges(canvasId: string): Promise<CanvasEdge[]>;
  insertEdge(canvasId: string, insert: CanvasEdgeInsert, now: Date): Promise<CanvasEdge>;
  removeEdge(canvasId: string, edgeId: string): Promise<boolean>;
}
