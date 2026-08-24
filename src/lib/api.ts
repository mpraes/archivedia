import type { NoteDto } from "@/lib/note-dto";

/**
 * Thin browser-side wrapper around /api/v1. Centralising fetch here keeps
 * the components free of URL strings and JSON shape concerns.
 */

const BASE = "/api/v1";

export interface ListNotesResponse {
  data: NoteDto[];
  meta: { date: string; timezone: string; total: number };
}

export interface SingleNoteResponse {
  data: NoteDto;
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
  listNotes(params: { date?: string; timezone?: string; limit?: number } = {}): Promise<ListNotesResponse> {
    const search = new URLSearchParams();
    if (params.date) search.set("date", params.date);
    if (params.timezone) search.set("timezone", params.timezone);
    if (params.limit !== undefined) search.set("limit", String(params.limit));
    const qs = search.toString();
    return getJson<ListNotesResponse>(`/notes${qs ? `?${qs}` : ""}`);
  },
  createNote(content: string): Promise<SingleNoteResponse> {
    return sendJson<SingleNoteResponse>("POST", "/notes", { content });
  },
  getNote(id: string): Promise<SingleNoteResponse> {
    return getJson<SingleNoteResponse>(`/notes/${encodeURIComponent(id)}`);
  },
  updateNote(id: string, content: string): Promise<SingleNoteResponse> {
    return sendJson<SingleNoteResponse>("PATCH", `/notes/${encodeURIComponent(id)}`, { content });
  },
  deleteNote(id: string): Promise<null> {
    return sendJson<null>("DELETE", `/notes/${encodeURIComponent(id)}`);
  },
  health(): Promise<{ status: string; service: string; timestamp: string; database: string }> {
    return getJson("/health");
  },
};
