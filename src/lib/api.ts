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
  createNote(content: string, tags?: string[]): Promise<SingleNoteResponse> {
    return sendJson<SingleNoteResponse>("POST", "/notes", { content, tags });
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
  health(): Promise<{ status: string; service: string; timestamp: string; database: string }> {
    return getJson("/health");
  },
};
