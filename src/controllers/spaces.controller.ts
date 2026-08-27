import type { NextRequest } from "next/server";
import { toErrorResponse } from "@/errors/error-handler";
import {
  addSpaceNoteBodySchema,
  createSpaceBodySchema,
  listSpacesQuerySchema,
  updateSpaceBodySchema,
} from "@/schemas/note.schema";
import { getNoteServiceDeps } from "@/services/dependencies";
import { noteDto } from "@/lib/note-dto";
import {
  addNoteToSpace,
  archiveSpace,
  createNoteInSpace,
  createSpace,
  getSpace,
  listSpaces,
  removeNoteFromSpace,
  updateSpace,
  type SpaceWithStats,
} from "@/services/spaces.service";

function spaceWithStatsDto(space: SpaceWithStats) {
  return {
    id: space.id,
    title: space.title,
    description: space.description,
    status: space.status,
    noteCount: space.noteCount,
    createdAt: space.createdAt.toISOString(),
    updatedAt: space.updatedAt.toISOString(),
  };
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const url = new URL(req.url);
    const query = listSpacesQuerySchema.parse({
      includeArchived: url.searchParams.get("includeArchived") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    const deps = getNoteServiceDeps();
    const spaces = await listSpaces(deps, query);
    return Response.json({
      data: spaces.map(spaceWithStatsDto),
      meta: { total: spaces.length },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = createSpaceBodySchema.parse(await req.json().catch(() => ({})));
    const deps = getNoteServiceDeps();
    const space = await createSpace(deps, {
      title: body.title,
      description: body.description ?? null,
    });
    return Response.json({ data: spaceWithStatsDto({ ...space, noteCount: 0 }) }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

// ---------- /spaces/[spaceId] ----------

interface RouteParams {
  params: Promise<{ spaceId: string }>;
}

export async function GET_ONE(_req: NextRequest, ctx: RouteParams): Promise<Response> {
  try {
    const { spaceId } = await ctx.params;
    const deps = getNoteServiceDeps();
    const space = await getSpace(deps, spaceId);
    return Response.json({ data: spaceWithStatsDto(space) });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH_ONE(req: NextRequest, ctx: RouteParams): Promise<Response> {
  try {
    const { spaceId } = await ctx.params;
    const body = updateSpaceBodySchema.parse(await req.json().catch(() => ({})));
    const deps = getNoteServiceDeps();
    const space = await updateSpace(deps, spaceId, {
      title: body.title,
      description: body.description,
      status: body.status,
    });
    const noteCount = await deps.spaceRepository.countNotes(spaceId);
    return Response.json({ data: spaceWithStatsDto({ ...space, noteCount }) });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE_ONE(_req: NextRequest, ctx: RouteParams): Promise<Response> {
  // Phase 2 / FR-37: archive is the only soft-delete path for a Space.
  // We expose it via DELETE for HTTP semantics, but the underlying
  // behaviour is status flip, not row deletion.
  try {
    const { spaceId } = await ctx.params;
    const deps = getNoteServiceDeps();
    const space = await archiveSpace(deps, spaceId);
    return Response.json({ data: spaceWithStatsDto({ ...space, noteCount: 0 }) });
  } catch (err) {
    return toErrorResponse(err);
  }
}

// ---------- /spaces/[spaceId]/notes ----------

export async function POST_NOTE(req: NextRequest, ctx: RouteParams): Promise<Response> {
  try {
    const { spaceId } = await ctx.params;
    const body = addSpaceNoteBodySchema.parse(await req.json().catch(() => ({})));
    const deps = getNoteServiceDeps();
    if ("noteId" in body) {
      const result = await addNoteToSpace(deps, {
        spaceId,
        noteId: body.noteId,
        addedBy: body.addedBy,
      });
      return Response.json({ data: result }, { status: 201 });
    }
    const note = await createNoteInSpace(deps, {
      spaceId,
      content: body.content,
      whyItMatters: body.whyItMatters ?? null,
      reference: body.reference ?? null,
    });
    return Response.json({ data: noteDto(note) }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE_NOTE(
  req: NextRequest,
  ctx: RouteParams,
): Promise<Response> {
  try {
    const { spaceId } = await ctx.params;
    const url = new URL(req.url);
    const noteId = url.searchParams.get("noteId");
    if (!noteId) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "noteId query param is required." } },
        { status: 422 },
      );
    }
    const deps = getNoteServiceDeps();
    await removeNoteFromSpace(deps, { spaceId, noteId });
    return new Response(null, { status: 204 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
