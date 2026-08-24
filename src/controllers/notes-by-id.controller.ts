import type { NextRequest } from "next/server";
import { toErrorResponse } from "@/errors/error-handler";
import { processNoteBodySchema, updateNoteBodySchema } from "@/schemas/note.schema";
import { deleteNote } from "@/services/delete-note.service";
import { getNote } from "@/services/get-note.service";
import { getNoteServiceDeps } from "@/services/dependencies";
import { processNote } from "@/services/process-note.service";
import { updateNote } from "@/services/update-note.service";
import { noteDto } from "@/lib/note-dto";

interface RouteParams {
  params: Promise<{ noteId: string }>;
}

function noteIdFromParams(params: { noteId: string }): string {
  // Accept either the technical UUID or the human-readable public id so
  // users can paste either form into the URL bar.
  return params.noteId;
}

export async function GET(_req: NextRequest, ctx: RouteParams): Promise<Response> {
  try {
    const { noteId } = await ctx.params;
    const note = await getNote(getNoteServiceDeps(), noteIdFromParams({ noteId }));
    return Response.json({ data: noteDto(note) });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(req: NextRequest, ctx: RouteParams): Promise<Response> {
  try {
    const { noteId } = await ctx.params;
    const body = updateNoteBodySchema.parse(await req.json().catch(() => ({})));
    const note = await updateNote(getNoteServiceDeps(), noteIdFromParams({ noteId }), body.content);
    return Response.json({ data: noteDto(note) });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteParams): Promise<Response> {
  try {
    const { noteId } = await ctx.params;
    await deleteNote(getNoteServiceDeps(), noteIdFromParams({ noteId }));
    return new Response(null, { status: 204 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST_PROCESS(req: NextRequest, ctx: RouteParams): Promise<Response> {
  try {
    const { noteId } = await ctx.params;
    const body = processNoteBodySchema.parse(await req.json().catch(() => ({})));
    const note = await processNote(
      getNoteServiceDeps(),
      noteIdFromParams({ noteId }),
      body.content,
    );
    return Response.json({ data: noteDto(note) });
  } catch (err) {
    return toErrorResponse(err);
  }
}
