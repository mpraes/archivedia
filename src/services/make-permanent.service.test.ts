import { beforeEach, describe, expect, it } from "vitest";
import { setNoteServiceDeps } from "@/services/dependencies";
import { InMemoryNoteRepository } from "@/repositories/in-memory-note.repository";
import { InMemorySpaceRepository, InMemorySpaceNoteRepository } from "@/repositories/in-memory-space.repository";
import { InMemoryCanvasRepository } from "@/repositories/in-memory-canvas.repository";
import { createNote } from "@/services/create-note.service";
import { makePermanent } from "@/services/make-permanent.service";
import { processNote } from "@/services/process-note.service";
import { AppError } from "@/errors/app-error";

const TIMEZONE = "America/Sao_Paulo";
const depsFor = () => ({ repository: new InMemoryNoteRepository(), spaceRepository: new InMemorySpaceRepository(), spaceNoteRepository: new InMemorySpaceNoteRepository(), canvasRepository: new InMemoryCanvasRepository(), timezone: TIMEZONE });

describe("makePermanent service", () => {
  beforeEach(() => setNoteServiceDeps(null));

  it("promotes an inbox note to permanent and stamps processedAt", async () => {
    const deps = depsFor();
    const note = await createNote(deps, "draft", {}, new Date("2026-08-20T12:00:00.000Z"));
    const promoted = await makePermanent(
      deps,
      note.id,
      "permanent rewrite",
      "because it matters",
      null,
      new Date("2026-08-26T12:00:00.000Z"),
    );
    expect(promoted.status).toBe("permanent");
    expect(promoted.content).toBe("permanent rewrite");
    expect(promoted.whyItMatters).toBe("because it matters");
    expect(promoted.processedAt?.toISOString()).toBe("2026-08-26T12:00:00.000Z");
    expect(promoted.lastReviewedAt?.toISOString()).toBe("2026-08-26T12:00:00.000Z");
    expect(promoted.reviewCount).toBe(1);
    // publicId and createdAt are preserved (FR-32 continuity).
    expect(promoted.publicId).toBe(note.publicId);
    expect(promoted.createdAt.toISOString()).toBe(note.createdAt.toISOString());
  });

  it("rejects notes that are not currently in inbox", async () => {
    const deps = depsFor();
    const note = await createNote(deps, "draft", {}, new Date("2026-08-20T12:00:00.000Z"));
    await processNote(deps, note.id, "already permanent");
    await expect(makePermanent(deps, note.id, "second attempt", null)).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it("returns not-found for unknown ids", async () => {
    const deps = depsFor();
    await expect(
      makePermanent(deps, "00000000-0000-0000-0000-000000000000", "x", null),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("treats whitespace-only whyItMatters as null", async () => {
    const deps = depsFor();
    const note = await createNote(deps, "draft", {}, new Date("2026-08-20T12:00:00.000Z"));
    const promoted = await makePermanent(
      deps,
      note.id,
      "rewrite",
      "   ",
      null,
      new Date("2026-08-26T12:00:00.000Z"),
    );
    expect(promoted.whyItMatters).toBeNull();
  });

  it("preserves reference across inbox→permanent transition", async () => {
    const deps = depsFor();
    const note = await createNote(
      deps,
      "draft",
      { reference: "Designing Data-Intensive Applications ch. 5" },
      new Date("2026-08-20T12:00:00.000Z"),
    );
    expect(note.reference).toBe("Designing Data-Intensive Applications ch. 5");

    const promoted = await makePermanent(
      deps,
      note.id,
      "permanent rewrite",
      null,
      "https://example.com/article",
      new Date("2026-08-26T12:00:00.000Z"),
    );
    expect(promoted.reference).toBe("https://example.com/article");
    expect(promoted.status).toBe("permanent");
  });
});
