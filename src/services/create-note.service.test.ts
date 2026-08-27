import { beforeEach, describe, expect, it } from "vitest";
import { setNoteServiceDeps } from "@/services/dependencies";
import { InMemoryNoteRepository } from "@/repositories/in-memory-note.repository";
import { InMemorySpaceRepository, InMemorySpaceNoteRepository } from "@/repositories/in-memory-space.repository";
import { InMemoryCanvasRepository } from "@/repositories/in-memory-canvas.repository";
import { createNote } from "@/services/create-note.service";

const TIMEZONE = "America/Sao_Paulo";
const depsFor = () => ({
  repository: new InMemoryNoteRepository(),
  spaceRepository: new InMemorySpaceRepository(),
  spaceNoteRepository: new InMemorySpaceNoteRepository(),
  canvasRepository: new InMemoryCanvasRepository(),
  timezone: TIMEZONE,
});

describe("create-note reference flow", () => {
  beforeEach(() => setNoteServiceDeps(null));

  it("persists a non-empty reference verbatim", async () => {
    const deps = depsFor();
    const note = await createNote(
      deps,
      "thought",
      { reference: "https://example.com/article" },
      new Date("2026-08-27T10:00:00.000Z"),
    );
    expect(note.reference).toBe("https://example.com/article");
  });

  it("trims surrounding whitespace from the reference", async () => {
    const deps = depsFor();
    const note = await createNote(
      deps,
      "thought",
      { reference: "  Book, chapter 3  " },
      new Date("2026-08-27T10:00:00.000Z"),
    );
    expect(note.reference).toBe("Book, chapter 3");
  });

  it("collapses whitespace-only references to null", async () => {
    const deps = depsFor();
    const note = await createNote(
      deps,
      "thought",
      { reference: "   " },
      new Date("2026-08-27T10:00:00.000Z"),
    );
    expect(note.reference).toBeNull();
  });

  it("defaults to null when reference is omitted", async () => {
    const deps = depsFor();
    const note = await createNote(
      deps,
      "thought",
      {},
      new Date("2026-08-27T10:00:00.000Z"),
    );
    expect(note.reference).toBeNull();
  });
});
