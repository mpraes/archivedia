import type { Note } from "@/domain/note";
import type { Space, SpaceStatus } from "@/domain/space";
import type { NoteRepository } from "@/repositories/note.repository";
import { AppError } from "@/errors/app-error";
import { logDbFailure } from "@/lib/logger";
import { extractLinkedNoteIds } from "@/lib/note-links";
import { formatPublicIdStem, minuteBucket } from "@/lib/public-note-id";
import type { SpaceNoteRepository } from "@/repositories/space-note.repository";
import type { SpaceRepository } from "@/repositories/space.repository";

/**
 * Combined service entry point. Lives in one file because Space
 * operations cross-cut the Note and Space repositories; splitting them
 * would force callers to know the internals of both.
 *
 * Errors:
 * - empty/whitespace title → AppError.validation (422)
 * - Space not found → AppError.notFound (404)
 * - Note not found or soft-deleted → AppError.notFound (404)
 * - repository transient failure → AppError.databaseUnavailable (503)
 */
export interface SpaceWithStats extends Space {
  noteCount: number;
}

/**
 * Dependency shape the Spaces service expects. Mirrors `NoteServiceDeps`
 * but with the notes repository renamed to `repository` for backwards
 * compatibility with the existing container — controllers pass
 * `getNoteServiceDeps()` directly.
 */
export interface SpacesServiceDeps {
  repository: NoteRepository;
  spaceRepository: SpaceRepository;
  spaceNoteRepository: SpaceNoteRepository;
  timezone: string;
}

export async function createSpace(
  deps: { spaceRepository: SpaceRepository },
  input: { title: string; description?: string | null },
  now: Date = new Date(),
): Promise<Space> {
  const title = input.title.trim();
  if (title.length === 0) {
    throw AppError.validation(
      { title: "Provide a non-empty title." },
      "Space title cannot be empty.",
    );
  }
  if (title.length > 200) {
    throw AppError.validation({ title: "Title is too long (max 200 chars)." });
  }
  try {
    return await deps.spaceRepository.insert({
      title,
      description: input.description ?? null,
      now,
    });
  } catch (err) {
    logDbFailure({ component: "spaces", op: "create", err });
    throw AppError.databaseUnavailable();
  }
}

export async function listSpaces(
  deps: { spaceRepository: SpaceRepository },
  input: { includeArchived?: boolean; limit?: number } = {},
): Promise<SpaceWithStats[]> {
  const limit = input.limit ?? 100;
  const spaces = await deps.spaceRepository.list({
    includeArchived: input.includeArchived ?? false,
    limit,
  });
  const counts = await Promise.all(
    spaces.map((space) => deps.spaceRepository.countNotes(space.id)),
  );
  return spaces.map((space, index) => ({ ...space, noteCount: counts[index] }));
}

export async function getSpace(
  deps: { spaceRepository: SpaceRepository },
  id: string,
): Promise<SpaceWithStats> {
  const space = await deps.spaceRepository.findById(id);
  if (!space) throw AppError.notFound();
  const noteCount = await deps.spaceRepository.countNotes(id);
  return { ...space, noteCount };
}

export interface UpdateSpacePatch {
  title?: string;
  description?: string | null;
  status?: SpaceStatus;
}

export async function updateSpace(
  deps: { spaceRepository: SpaceRepository },
  id: string,
  patch: UpdateSpacePatch,
  now: Date = new Date(),
): Promise<Space> {
  if (patch.title === undefined && patch.description === undefined && patch.status === undefined) {
    throw AppError.validation(
      { _: "Provide at least one of `title`, `description`, or `status`." },
      "Empty Space patch.",
    );
  }
  if (patch.title !== undefined && patch.title.trim().length === 0) {
    throw AppError.validation(
      { title: "Title cannot be empty." },
      "Space title cannot be empty.",
    );
  }
  try {
    const updated = await deps.spaceRepository.patch(id, patch, now);
    if (!updated) throw AppError.notFound();
    return updated;
  } catch (err) {
    if (err instanceof AppError) throw err;
    logDbFailure({ component: "spaces", op: "update", err, spaceId: id });
    throw AppError.databaseUnavailable();
  }
}

export async function archiveSpace(
  deps: { spaceRepository: SpaceRepository },
  id: string,
  now: Date = new Date(),
): Promise<Space> {
  return updateSpace(deps, id, { status: "archived" }, now);
}

/**
 * FR-39 / FR-40 / FR-44: attach an existing note to a Space. Returns
 * the created membership row. Soft-deleted notes cannot be attached —
 * the user must restore the note first or create a new one inside
 * the Space.
 */
export async function addNoteToSpace(
  deps: {
    repository: NoteRepository;
    spaceRepository: SpaceRepository;
    spaceNoteRepository: SpaceNoteRepository;
  },
  input: { spaceId: string; noteId: string; addedBy?: "manual" | "review" },
  now: Date = new Date(),
): Promise<{ spaceId: string; noteId: string }> {
  const [space, note] = await Promise.all([
    deps.spaceRepository.findById(input.spaceId),
    deps.repository.findActiveById(input.noteId),
  ]);
  if (!space) throw AppError.notFound();
  if (!note) throw AppError.notFound();
  try {
    await deps.spaceNoteRepository.add({
      spaceId: input.spaceId,
      noteId: input.noteId,
      addedBy: input.addedBy ?? "manual",
      addedAt: now,
    });
    return { spaceId: input.spaceId, noteId: input.noteId };
  } catch (err) {
    logDbFailure({ component: "spaces", op: "add_note", err });
    throw AppError.databaseUnavailable();
  }
}

export async function removeNoteFromSpace(
  deps: { spaceNoteRepository: SpaceNoteRepository },
  input: { spaceId: string; noteId: string },
): Promise<void> {
  const removed = await deps.spaceNoteRepository.remove(input.spaceId, input.noteId);
  if (!removed) throw AppError.notFound();
}

/**
 * FR-41 / FR-42: create a new note that lives inside a Space from the
 * moment of birth. We allocate the public id via the same minute-bucket
 * scheme as Today so identifiers remain globally unique, then link the
 * new note to the Space in a single write path.
 *
 * Note that the created note is independent of the Space — it stays in
 * the global inbox/permanent bucket. The Space merely references it.
 */
export async function createNoteInSpace(
  deps: SpacesServiceDeps,
  input: { spaceId: string; content: string; whyItMatters?: string | null; reference?: string | null },
  now: Date = new Date(),
): Promise<Note> {
  const content = input.content.trim();
  if (content.length === 0) {
    throw AppError.validation(
      { content: "Provide a non-empty content body." },
      "Note content cannot be empty.",
    );
  }
  const space = await deps.spaceRepository.findById(input.spaceId);
  if (!space) throw AppError.notFound();

  const bucket = minuteBucket(now, deps.timezone);
  const bucketPrefix = `${bucket}-`;
  const existing = await deps.repository.countByPublicIdPrefix(bucketPrefix);
  const publicId = formatPublicIdStem(now, deps.timezone, existing + 1);
  const linkedNoteIds = extractLinkedNoteIds(content);
  const whyItMatters = input.whyItMatters?.trim() || null;
  const reference = input.reference?.trim() || null;

  try {
    const note = await deps.repository.insert({
      publicId,
      content,
      whyItMatters,
      reference,
      linkedNoteIds,
      tags: [],
      createdAt: now,
    });
    await deps.spaceNoteRepository.add({
      spaceId: input.spaceId,
      noteId: note.id,
      addedBy: "created-in-space",
      addedAt: now,
    });
    return note;
  } catch (err) {
    logDbFailure({ component: "spaces", op: "create_note", err, spaceId: input.spaceId });
    throw AppError.databaseUnavailable();
  }
}

/**
 * Step 2.5: list notes attached to a Space, newest membership first.
 * We pull only the noteIds from the join table and then hydrate each
 * one individually so soft-deleted notes are filtered out without
 * pulling their full bodies.
 */
export async function listNotesInSpace(
  deps: SpacesServiceDeps,
  input: { spaceId: string; limit?: number },
): Promise<Note[]> {
  const limit = input.limit ?? 200;
  const ids = await deps.spaceNoteRepository.listNoteIdsBySpace({
    spaceId: input.spaceId,
    limit,
  });
  const notes = await Promise.all(ids.map((id) => deps.repository.findActiveById(id)));
  return notes.filter((note): note is Note => note !== null);
}
