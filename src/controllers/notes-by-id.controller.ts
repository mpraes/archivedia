import type { NextRequest } from "next/server";
import { toErrorResponse } from "@/errors/error-handler";
import {
  deferReviewBodySchema,
  makePermanentBodySchema,
  processNoteBodySchema,
  updateNoteBodySchema,
} from "@/schemas/note.schema";
import { deferReview } from "@/services/defer-review.service";
import { deleteNote } from "@/services/delete-note.service";
import { getNote } from "@/services/get-note.service";
import { getBacklinks } from "@/services/backlinks.service";
import { getNoteServiceDeps } from "@/services/dependencies";
import { makePermanent } from "@/services/make-permanent.service";
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
    const note = await updateNote(
      getNoteServiceDeps(),
      noteIdFromParams({ noteId }),
      { content: body.content, tags: body.tags },
    );
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

export async function POST_MAKE_PERMANENT(
  req: NextRequest,
  ctx: RouteParams,
): Promise<Response> {
  try {
    const { noteId } = await ctx.params;
    const body = makePermanentBodySchema.parse(await req.json().catch(() => ({})));
    const note = await makePermanent(
      getNoteServiceDeps(),
      noteIdFromParams({ noteId }),
      body.content,
      body.whyItMatters ?? null,
    );
    return Response.json({ data: noteDto(note) });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST_DEFER_REVIEW(
  req: NextRequest,
  ctx: RouteParams,
): Promise<Response> {
  try {
    const { noteId } = await ctx.params;
    const body = deferReviewBodySchema.parse(await req.json().catch(() => ({})));
    const note = await deferReview(
      getNoteServiceDeps(),
      noteIdFromParams({ noteId }),
      new Date(body.nextReviewAt),
      body.reason ?? null,
    );
    return Response.json({ data: noteDto(note) });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function GET_BACKLINKS(_req: NextRequest, ctx: RouteParams): Promise<Response> {
  try {
    const { noteId } = await ctx.params;
    const notes = await getBacklinks(getNoteServiceDeps(), noteIdFromParams({ noteId }));
    return Response.json({ data: notes.map(noteDto) });
  } catch (err) {
    return toErrorResponse(err);
  }
}
