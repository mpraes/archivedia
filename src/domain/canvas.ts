/**
 * Phase 3 / Canvas (requirements_v2). The Canvas is a per-Space visual
 * surface where the user arranges note-cards and free-text cards on
 * an infinite canvas. Phase 3 ships one Canvas per Space (named
 * "Main canvas" by default); the schema leaves room for multiple
 * canvases per Space in a later iteration.
 */

export type CanvasNodeType = "note" | "text";

/** Side handle identifiers — must match the JSON Canvas spec. */
export type CanvasHandle = "top" | "right" | "bottom" | "left";

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface Canvas {
  readonly id: string;
  readonly spaceId: string;
  readonly name: string;
  readonly viewport: CanvasViewport;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CanvasNode {
  readonly id: string;
  readonly canvasId: string;
  readonly type: CanvasNodeType;
  /** Set when `type === "note"`. Soft-deleted notes null this out
   *  so the card stays on the canvas as an empty placeholder. */
  readonly noteId: string | null;
  /** Set when `type === "text"`. */
  readonly text: string | null;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly zIndex: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CanvasEdge {
  readonly id: string;
  readonly canvasId: string;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly label: string | null;
  readonly sourceHandle: CanvasHandle | null;
  readonly targetHandle: CanvasHandle | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
