import { beforeEach, describe, expect, it } from "vitest";
import { setNoteServiceDeps } from "@/services/dependencies";
import { InMemoryNoteRepository } from "@/repositories/in-memory-note.repository";
import { InMemorySpaceRepository, InMemorySpaceNoteRepository } from "@/repositories/in-memory-space.repository";
import { InMemoryCanvasRepository } from "@/repositories/in-memory-canvas.repository";
import { createNote } from "@/services/create-note.service";
import { deferReview } from "@/services/defer-review.service";
import { makePermanent } from "@/services/make-permanent.service";
import { AppError } from "@/errors/app-error";

const TIMEZONE = "America/Sao_Paulo";
const depsFor = () => ({ repository: new InMemoryNoteRepository(), spaceRepository: new InMemorySpaceRepository(), spaceNoteRepository: new InMemorySpaceNoteRepository(), canvasRepository: new InMemoryCanvasRepository(), timezone: TIMEZONE });

describe("deferReview service", () => {
  beforeEach(() => setNoteServiceDeps(null));

  it("pushes nextReviewAt forward and stamps lastReviewedAt + reviewCount", async () => {
    const deps = depsFor();
    const note = await createNote(deps, "draft", {}, new Date("2026-08-20T12:00:00.000Z"));
    const next = new Date("2026-08-30T12:00:00.000Z");
    const deferred = await deferReview(
      deps,
      note.id,
      next,
      "Need to read more",
      new Date("2026-08-26T12:00:00.000Z"),
    );
    expect(deferred.status).toBe("inbox");
    expect(deferred.nextReviewAt?.toISOString()).toBe(next.toISOString());
    expect(deferred.lastReviewedAt?.toISOString()).toBe("2026-08-26T12:00:00.000Z");
    expect(deferred.reviewCount).toBe(1);
    // Content and publicId untouched.
    expect(deferred.content).toBe("draft");
    expect(deferred.publicId).toBe(note.publicId);
  });

  it("rejects permanent notes (cannot defer what is already permanent)", async () => {
    const deps = depsFor();
    const note = await createNote(deps, "draft", {}, new Date("2026-08-20T12:00:00.000Z"));
    await makePermanent(deps, note.id, "permanent rewrite", null, new Date("2026-08-26T12:00:00.000Z"));
    await expect(
      deferReview(deps, note.id, new Date("2026-08-30T12:00:00.000Z"), null),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("returns not-found for unknown ids", async () => {
    const deps = depsFor();
    await expect(
      deferReview(
        deps,
        "00000000-0000-0000-0000-000000000000",
        new Date("2026-08-30T12:00:00.000Z"),
        null,
      ),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("rejects an invalid nextReviewAt Date", async () => {
    const deps = depsFor();
    const note = await createNote(deps, "draft", {}, new Date("2026-08-20T12:00:00.000Z"));
    await expect(deferReview(deps, note.id, new Date("not-a-date"), null)).rejects.toBeInstanceOf(
      AppError,
    );
  });
});
