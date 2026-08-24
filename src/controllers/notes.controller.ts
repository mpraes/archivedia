import type { NextRequest } from "next/server";
import { toErrorResponse } from "@/errors/error-handler";
import {
  createNoteBodySchema,
  listNotesQuerySchema,
  parseDateParam,
} from "@/schemas/note.schema";
import { createNote } from "@/services/create-note.service";
import { listDailyNotes } from "@/services/list-daily-notes.service";
import { getNoteServiceDeps } from "@/services/dependencies";
import { noteDto } from "@/lib/note-dto";

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const json = await req.json().catch(() => ({}));
    const body = createNoteBodySchema.parse(json);
    const deps = getNoteServiceDeps();
    const note = await createNote(deps, body.content);
    return Response.json({ data: noteDto(note) }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const url = new URL(req.url);
    const query = listNotesQuerySchema.parse({
      date: parseDateParam(url.searchParams.get("date") ?? undefined),
      timezone: url.searchParams.get("timezone") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    const deps = getNoteServiceDeps();
    const result = await listDailyNotes(deps, query);
    return Response.json({
      data: result.notes.map(noteDto),
      meta: { date: result.date, timezone: result.timezone, total: result.total },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
