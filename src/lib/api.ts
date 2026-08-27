import type { NoteDto } from "@/lib/note-dto";
import type { NoteStatus } from "@/domain/note-status";

/**
 * Thin browser-side wrapper around /api/v1. Centralising fetch here keeps
 * the components free of URL strings and JSON shape concerns.
 */

const BASE = "/api/v1";

export interface ListNotesParams {
  date?: string;
  timezone?: string;
  limit?: number;
  /** Cross-day content search. When set, `date` is ignored on the server. */
  q?: string;
  /** Filter by status; "permanent" surfaces the recall view. */
  status?: NoteStatus;
  /** Filter by tag membership. */
  tag?: string;
}

export interface ListNotesResponse {
  data: NoteDto[];
  meta: { date: string; timezone: string; total: number };
}

export interface SingleNoteResponse {
  data: NoteDto;
}

export interface BacklinksResponse {
  data: NoteDto[];
}

/**
 * Lightweight DTO for the Review queue page. Mirrors the wire shape from
 * `GET /api/v1/review/notes` so the front-end never has to import the
 * server-side type.
 */
export interface ReviewQueueItemDto {
  id: string;
  publicId: string;
  content: string;
  whyItMatters: string | null;
  status: "inbox";
  createdAt: string;
  updatedAt: string;
  reviewCount: number;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  waitingSinceHours: number;
}

export interface ReviewQueueResponse {
  data: ReviewQueueItemDto[];
  meta: { readyForReview: number; returned: number };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;
  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

async function parseError(res: Response): Promise<ApiError> {
  let code = "INTERNAL_ERROR";
  let message = "Unexpected server error.";
  let fields: Record<string, string> | undefined;
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string; fields?: Record<string, string> } };
    if (body.error) {
      code = body.error.code ?? code;
      message = body.error.message ?? message;
      fields = body.error.fields;
    }
  } catch {
    // ignore parse errors and use defaults
  }
  return new ApiError(res.status, code, message, fields);
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}

async function sendJson<T>(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (res.status === 204) return undefined as unknown as T;
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}

export const api = {
  listNotes(params: ListNotesParams = {}): Promise<ListNotesResponse> {
    const search = new URLSearchParams();
    if (params.date) search.set("date", params.date);
    if (params.timezone) search.set("timezone", params.timezone);
    if (params.limit !== undefined) search.set("limit", String(params.limit));
    if (params.q) search.set("q", params.q);
    if (params.status) search.set("status", params.status);
    if (params.tag) search.set("tag", params.tag);
    const qs = search.toString();
    return getJson<ListNotesResponse>(`/notes${qs ? `?${qs}` : ""}`);
  },
  createNote(
    content: string,
    tags?: string[],
    whyItMatters?: string | null,
  ): Promise<SingleNoteResponse> {
    return sendJson<SingleNoteResponse>("POST", "/notes", {
      content,
      tags,
      whyItMatters: whyItMatters ?? undefined,
    });
  },
  getNote(id: string): Promise<SingleNoteResponse> {
    return getJson<SingleNoteResponse>(`/notes/${encodeURIComponent(id)}`);
  },
  /**
   * Partial update. Pass `content` to rewrite (links re-extracted),
   * `tags` to replace the tag list, or both. At least one is required.
   * Pass `tags: []` to clear all tags.
   */
  updateNote(id: string, patch: { content?: string; tags?: string[] }): Promise<SingleNoteResponse> {
    return sendJson<SingleNoteResponse>("PATCH", `/notes/${encodeURIComponent(id)}`, patch);
  },
  deleteNote(id: string): Promise<null> {
    return sendJson<null>("DELETE", `/notes/${encodeURIComponent(id)}`);
  },
  /**
   * Promote an inbox note to permanent by rewriting its content in a single
   * atomic transition. Server returns 409 NOTE_NOT_PROCESSABLE when the
   * note is not in `inbox` status, or 404 NOTE_NOT_FOUND when it is
   * missing or soft-deleted.
   */
  processNote(id: string, content: string): Promise<SingleNoteResponse> {
    return sendJson<SingleNoteResponse>(
      "POST",
      `/notes/${encodeURIComponent(id)}/process`,
      { content },
    );
  },
  getBacklinks(id: string): Promise<BacklinksResponse> {
    return getJson<BacklinksResponse>(`/notes/${encodeURIComponent(id)}/backlinks`);
  },
  /**
   * FR-30 / FR-31: list inbox notes that have aged past the 48-hour
   * review gate. `limit` defaults to 50 server-side. The response
   * meta.readyForReview drives the Today alert banner (FR-28) so the
   * page can decide whether to show "Start review".
   */
  listReviewQueue(limit?: number): Promise<ReviewQueueResponse> {
    const qs = limit !== undefined ? `?limit=${limit}` : "";
    return getJson<ReviewQueueResponse>(`/review/notes${qs}`);
  },
  /**
   * FR-34: keep a note in the inbox but push `nextReviewAt` into the
   * future. The server stamps `lastReviewedAt` and bumps `reviewCount`.
   */
  deferReview(
    id: string,
    input: { nextReviewAt: string; reason?: string },
  ): Promise<SingleNoteResponse> {
    return sendJson<SingleNoteResponse>(
      "POST",
      `/notes/${encodeURIComponent(id)}/defer-review`,
      input,
    );
  },
  /**
   * FR-32: promote an inbox note to permanent from the Review page.
   * `whyItMatters` is optional and lets the user record or refine the
   * "Why does this matter?" answer at the same time.
   */
  makePermanent(
    id: string,
    input: { content: string; whyItMatters?: string | null },
  ): Promise<SingleNoteResponse> {
    return sendJson<SingleNoteResponse>(
      "POST",
      `/notes/${encodeURIComponent(id)}/make-permanent`,
      input,
    );
  },
  // ---------- Spaces (Phase 2) ----------
  listSpaces(params?: { includeArchived?: boolean; limit?: number }): Promise<{
    data: SpaceDto[];
    meta: { total: number };
  }> {
    const search = new URLSearchParams();
    if (params?.includeArchived) search.set("includeArchived", "true");
    if (params?.limit !== undefined) search.set("limit", String(params.limit));
    const qs = search.toString();
    return getJson(`/spaces${qs ? `?${qs}` : ""}`);
  },
  createSpace(input: { title: string; description?: string }): Promise<{ data: SpaceDto }> {
    return sendJson("POST", "/spaces", input);
  },
  getSpace(id: string): Promise<{ data: SpaceDto }> {
    return getJson(`/spaces/${encodeURIComponent(id)}`);
  },
  archiveSpace(id: string): Promise<{ data: SpaceDto }> {
    return sendJson("DELETE", `/spaces/${encodeURIComponent(id)}`);
  },
  attachNoteToSpace(
    spaceId: string,
    input: { noteId: string; addedBy?: "manual" | "review" },
  ): Promise<{ data: { spaceId: string; noteId: string } }> {
    return sendJson("POST", `/spaces/${encodeURIComponent(spaceId)}/notes`, input);
  },
  createNoteInSpace(
    spaceId: string,
    input: { content: string; whyItMatters?: string },
  ): Promise<SingleNoteResponse> {
    return sendJson("POST", `/spaces/${encodeURIComponent(spaceId)}/notes`, input);
  },
  removeNoteFromSpace(spaceId: string, noteId: string): Promise<null> {
    return sendJson(
      "DELETE",
      `/spaces/${encodeURIComponent(spaceId)}/notes?noteId=${encodeURIComponent(noteId)}`,
    );
  },
  // ---------- Canvas (Phase 3) ----------
  getCanvas(spaceId: string): Promise<{ data: CanvasBundleDto }> {
    return getJson(`/spaces/${encodeURIComponent(spaceId)}/canvas`);
  },
  patchCanvasViewport(
    spaceId: string,
    viewport: { x: number; y: number; zoom: number },
  ): Promise<{ data: { viewport: { x: number; y: number; zoom: number } } }> {
    return sendJson("PATCH", `/spaces/${encodeURIComponent(spaceId)}/canvas/viewport`, viewport);
  },
  addCanvasNode(
    spaceId: string,
    input: CanvasNodeCreateDto,
  ): Promise<{ data: CanvasNodeDto }> {
    return sendJson("POST", `/spaces/${encodeURIComponent(spaceId)}/canvas/nodes`, input);
  },
  patchCanvasNode(
    spaceId: string,
    nodeId: string,
    patch: CanvasNodeLayoutPatchDto,
  ): Promise<{ data: CanvasNodeDto }> {
    return sendJson(
      "PATCH",
      `/spaces/${encodeURIComponent(spaceId)}/canvas/nodes/${encodeURIComponent(nodeId)}`,
      patch,
    );
  },
  removeCanvasNode(spaceId: string, nodeId: string): Promise<null> {
    return sendJson(
      "DELETE",
      `/spaces/${encodeURIComponent(spaceId)}/canvas/nodes/${encodeURIComponent(nodeId)}`,
    );
  },
  addCanvasEdge(
    spaceId: string,
    input: CanvasEdgeCreateDto,
  ): Promise<{ data: CanvasEdgeDto }> {
    return sendJson("POST", `/spaces/${encodeURIComponent(spaceId)}/canvas/edges`, input);
  },
  removeCanvasEdge(spaceId: string, edgeId: string): Promise<null> {
    return sendJson(
      "DELETE",
      `/spaces/${encodeURIComponent(spaceId)}/canvas/edges/${encodeURIComponent(edgeId)}`,
    );
  },
  health(): Promise<{ status: string; service: string; timestamp: string; database: string }> {
    return getJson("/health");
  },
};

// ---------- Phase 3: Canvas DTOs ----------
export interface CanvasViewportDto {
  x: number;
  y: number;
  zoom: number;
}

export interface CanvasDto {
  id: string;
  spaceId: string;
  name: string;
  viewport: CanvasViewportDto;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasNodeDto {
  id: string;
  canvasId: string;
  type: "note" | "text";
  noteId: string | null;
  text: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasEdgeDto {
  id: string;
  canvasId: string;
  sourceNodeId: string;
  targetNodeId: string;
  label: string | null;
  sourceHandle: "top" | "right" | "bottom" | "left" | null;
  targetHandle: "top" | "right" | "bottom" | "left" | null;
  createdAt: string;
  updatedAt: string;
}

export interface CanvasBundleDto {
  canvas: CanvasDto;
  nodes: CanvasNodeDto[];
  edges: CanvasEdgeDto[];
}

export interface CanvasNodeCreateDto {
  type: "note" | "text";
  noteId?: string;
  text?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
}

export interface CanvasNodeLayoutPatchDto {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  zIndex?: number;
}

export interface CanvasEdgeCreateDto {
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
  sourceHandle?: "top" | "right" | "bottom" | "left";
  targetHandle?: "top" | "right" | "bottom" | "left";
}

export interface SpaceDto {
  id: string;
  title: string;
  description: string | null;
  status: "active" | "completed" | "archived";
  noteCount: number;
  createdAt: string;
  updatedAt: string;
}
