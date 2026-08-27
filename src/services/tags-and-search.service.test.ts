import { beforeEach, describe, expect, it } from "vitest";
import { setNoteServiceDeps } from "@/services/dependencies";
import { InMemoryNoteRepository } from "@/repositories/in-memory-note.repository";
import { InMemorySpaceRepository, InMemorySpaceNoteRepository } from "@/repositories/in-memory-space.repository";
import { InMemoryCanvasRepository } from "@/repositories/in-memory-canvas.repository";
import { createNote } from "@/services/create-note.service";
import { updateNote } from "@/services/update-note.service";
import { listDailyNotes } from "@/services/list-daily-notes.service";
import { AppError } from "@/errors/app-error";

const TIMEZONE = "America/Sao_Paulo";
const depsFor = () => ({ repository: new InMemoryNoteRepository(), spaceRepository: new InMemorySpaceRepository(), spaceNoteRepository: new InMemorySpaceNoteRepository(), canvasRepository: new InMemoryCanvasRepository(), timezone: TIMEZONE });

describe("tags + search (v0.5)", () => {
  beforeEach(() => setNoteServiceDeps(null));

  it("persists normalised tags on create", async () => {
    const deps = depsFor();
    const note = await createNote(
      deps,
      "tagged thought",
      { tags: ["  Work ", "Work", "PERSONAL"] },
      new Date("2026-08-24T14:32:05.000Z"),
    );
    expect(note.tags).toEqual(["work", "personal"]);
  });

  it("update with tags-only clears-or-sets without touching content", async () => {
    const deps = depsFor();
    const note = await createNote(deps, "draft", {}, new Date("2026-08-24T14:32:05.000Z"));
    const updated = await updateNote(
      deps,
      note.id,
      { tags: ["idea"] },
      new Date("2026-08-24T15:00:00.000Z"),
    );
    expect(updated.tags).toEqual(["idea"]);
    expect(updated.content).toBe("draft");
  });

  it("update with empty tags array clears all tags", async () => {
    const deps = depsFor();
    const note = await createNote(
      deps,
      "draft",
      { tags: ["a", "b"] },
      new Date("2026-08-24T14:32:05.000Z"),
    );
    const updated = await updateNote(
      deps,
      note.id,
      { tags: [] },
      new Date("2026-08-24T15:00:00.000Z"),
    );
    expect(updated.tags).toEqual([]);
  });

  it("update with empty patch is rejected with 422", async () => {
    const deps = depsFor();
    const note = await createNote(deps, "draft", {}, new Date("2026-08-24T14:32:05.000Z"));
    await expect(updateNote(deps, note.id, {}, new Date("2026-08-24T15:00:00.000Z"))).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it("listWithFilters narrows by tag", async () => {
    const deps = depsFor();
    await createNote(deps, "alpha", { tags: ["work"] }, new Date("2026-08-24T14:32:05.000Z"));
    await createNote(deps, "beta", { tags: ["personal"] }, new Date("2026-08-24T14:35:05.000Z"));
    await createNote(deps, "gamma", { tags: ["work"] }, new Date("2026-08-24T14:40:05.000Z"));

    const result = await listDailyNotes(deps, { tag: "work" });
    expect(result.notes.map((n) => n.content).sort()).toEqual(["alpha", "gamma"]);
  });

  it("listWithFilters narrows by status", async () => {
    const deps = depsFor();
    const inbox = await createNote(
      deps,
      "draft",
      {},
      new Date("2026-08-24T14:32:05.000Z"),
    );
    const permanent = await createNote(
      deps,
      "idea",
      {},
      new Date("2026-08-24T14:35:05.000Z"),
    );
    // promote the second one
    const { processNote } = await import("@/services/process-note.service");
    await processNote(deps, permanent.id, "permanent idea");

    const inboxOnly = await listDailyNotes(deps, { status: "inbox" });
    const permOnly = await listDailyNotes(deps, { status: "permanent" });

    expect(inboxOnly.notes.map((n) => n.id)).toContain(inbox.id);
    expect(inboxOnly.notes.map((n) => n.id)).not.toContain(permanent.id);
    expect(permOnly.notes.map((n) => n.id)).toContain(permanent.id);
    expect(permOnly.notes.map((n) => n.id)).not.toContain(inbox.id);
  });

  it("listWithFilters searches by content case-insensitively and ignores date", async () => {
    const deps = depsFor();
    await createNote(deps, "Hello World", {}, new Date("2026-08-20T10:00:00.000Z"));
    await createNote(deps, "goodbye world", {}, new Date("2026-08-24T10:00:00.000Z"));
    await createNote(deps, "unrelated", {}, new Date("2026-08-25T10:00:00.000Z"));

    const result = await listDailyNotes(deps, { q: "WORLD", date: "2026-08-24" });
    // date is ignored when q is present; both WORLD notes surface.
    expect(result.notes.map((n) => n.content).sort()).toEqual(["Hello World", "goodbye world"]);
  });
});
