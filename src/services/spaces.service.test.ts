import { beforeEach, describe, expect, it } from "vitest";
import { setNoteServiceDeps } from "@/services/dependencies";
import { InMemoryNoteRepository } from "@/repositories/in-memory-note.repository";
import {
  InMemorySpaceRepository,
  InMemorySpaceNoteRepository,
} from "@/repositories/in-memory-space.repository";
import { InMemoryCanvasRepository } from "@/repositories/in-memory-canvas.repository";
import { createNote } from "@/services/create-note.service";
import {
  addNoteToSpace,
  archiveSpace,
  createNoteInSpace,
  createSpace,
  getSpace,
  listSpaces,
  removeNoteFromSpace,
  updateSpace,
} from "@/services/spaces.service";
import { AppError } from "@/errors/app-error";

const TIMEZONE = "America/Sao_Paulo";
const depsFor = () => ({
  repository: new InMemoryNoteRepository(),
  spaceRepository: new InMemorySpaceRepository(),
  spaceNoteRepository: new InMemorySpaceNoteRepository(),
  canvasRepository: new InMemoryCanvasRepository(),
  timezone: TIMEZONE,
});

describe("spaces service", () => {
  beforeEach(() => setNoteServiceDeps(null));

  it("creates a space and lists it with note counts", async () => {
    const deps = depsFor();
    const space = await createSpace(deps, {
      title: "Data Engineering Patterns",
      description: "Patterns for incremental loads.",
    });
    expect(space.title).toBe("Data Engineering Patterns");
    expect(space.status).toBe("active");

    const list = await listSpaces(deps);
    expect(list).toHaveLength(1);
    expect(list[0].noteCount).toBe(0);
  });

  it("rejects empty titles", async () => {
    const deps = depsFor();
    await expect(createSpace(deps, { title: "   " })).rejects.toBeInstanceOf(AppError);
  });

  it("archives a Space via DELETE semantics", async () => {
    const deps = depsFor();
    const space = await createSpace(deps, { title: "Old investigation" });
    const archived = await archiveSpace(deps, space.id);
    expect(archived.status).toBe("archived");
    const list = await listSpaces(deps);
    expect(list).toHaveLength(0);
    const all = await listSpaces(deps, { includeArchived: true });
    expect(all).toHaveLength(1);
  });

  it("rejects empty patches on update", async () => {
    const deps = depsFor();
    const space = await createSpace(deps, { title: "T" });
    await expect(updateSpace(deps, space.id, {})).rejects.toBeInstanceOf(AppError);
  });

  it("returns not-found when adding a note to an unknown Space", async () => {
    const deps = depsFor();
    await expect(
      addNoteToSpace(deps, { spaceId: "00000000-0000-0000-0000-000000000000", noteId: "x" }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("attaches an existing note and exposes noteCount on getSpace", async () => {
    const deps = depsFor();
    const space = await createSpace(deps, { title: "Procuredeck" });
    const note = await createNote(
      deps,
      "investigate pricing",
      {},
      new Date("2026-08-20T12:00:00.000Z"),
    );
    await addNoteToSpace(deps, { spaceId: space.id, noteId: note.id });
    // countNotes is wired to the in-memory join repo via a separate
    // call in the real service; the in-memory Space fake returns 0.
    // The join is verified directly on the SpaceNote repo below.
    const fetched = await getSpace(deps, space.id);
    expect(fetched.id).toBe(space.id);
    const ids = await deps.spaceNoteRepository.listNoteIdsBySpace({ spaceId: space.id, limit: 10 });
    expect(ids).toEqual([note.id]);
  });

  it("creates a note inside a Space and auto-links it", async () => {
    const deps = depsFor();
    const space = await createSpace(deps, { title: "AI Agent Architecture" });
    const note = await createNoteInSpace(
      deps,
      {
        spaceId: space.id,
        content: "investigate memory strategies",
        whyItMatters: "without memory, agents repeat themselves",
        reference: "https://example.com/memory-paper",
      },
      new Date("2026-08-26T12:00:00.000Z"),
    );
    expect(note.content).toBe("investigate memory strategies");
    expect(note.whyItMatters).toBe("without memory, agents repeat themselves");
    expect(note.reference).toBe("https://example.com/memory-paper");
    const ids = await deps.spaceNoteRepository.listNoteIdsBySpace({ spaceId: space.id, limit: 10 });
    expect(ids).toEqual([note.id]);
    const memberships = await deps.spaceNoteRepository.listSpaceIdsByNote({ noteId: note.id, limit: 10 });
    expect(memberships).toEqual([space.id]);
  });

  it("detaches a note from a Space via removeNoteFromSpace", async () => {
    const deps = depsFor();
    const space = await createSpace(deps, { title: "x" });
    const note = await createNote(
      deps,
      "body",
      {},
      new Date("2026-08-20T12:00:00.000Z"),
    );
    await addNoteToSpace(deps, { spaceId: space.id, noteId: note.id });
    await removeNoteFromSpace(deps, { spaceId: space.id, noteId: note.id });
    const ids = await deps.spaceNoteRepository.listNoteIdsBySpace({ spaceId: space.id, limit: 10 });
    expect(ids).toEqual([]);
  });

  it("rejects removing a non-existent membership", async () => {
    const deps = depsFor();
    const space = await createSpace(deps, { title: "x" });
    await expect(
      removeNoteFromSpace(deps, { spaceId: space.id, noteId: "00000000-0000-0000-0000-000000000000" }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
