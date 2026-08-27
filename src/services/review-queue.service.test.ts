import { beforeEach, describe, expect, it } from "vitest";
import { setNoteServiceDeps } from "@/services/dependencies";
import { InMemoryNoteRepository } from "@/repositories/in-memory-note.repository";
import { InMemorySpaceRepository, InMemorySpaceNoteRepository } from "@/repositories/in-memory-space.repository";
import { InMemoryCanvasRepository } from "@/repositories/in-memory-canvas.repository";
import { createNote } from "@/services/create-note.service";
import { listReviewQueue } from "@/services/review-queue.service";
import { AppError } from "@/errors/app-error";

const TIMEZONE = "America/Sao_Paulo";
const depsFor = () => ({ repository: new InMemoryNoteRepository(), spaceRepository: new InMemorySpaceRepository(), spaceNoteRepository: new InMemorySpaceNoteRepository(), canvasRepository: new InMemoryCanvasRepository(), timezone: TIMEZONE });

const NOW = new Date("2026-08-26T12:00:00.000Z");
const OLD = new Date("2026-08-20T12:00:00.000Z");
const RECENT = new Date("2026-08-25T20:00:00.000Z");

describe("listReviewQueue service", () => {
  beforeEach(() => setNoteServiceDeps(null));

  it("returns inbox notes older than 48h, oldest first", async () => {
    const deps = depsFor();
    const a = await createNote(deps, "oldest", {}, OLD);
    const b = await createNote(deps, "middle", {}, new Date("2026-08-23T12:00:00.000Z"));
    const c = await createNote(deps, "recent-but-old", {}, new Date("2026-08-24T12:00:00.000Z"));

    // A fresh note (under 48h) must NOT appear.
    await createNote(deps, "too fresh", {}, RECENT);

    const result = await listReviewQueue(deps, {}, NOW);
    expect(result.total).toBe(3);
    expect(result.items.map((item) => item.id)).toEqual([a.id, b.id, c.id]);
    // Each queue item carries a human-friendly "waiting since" hint.
    // The oldest note is 6 days old → at least 144 hours waiting.
    expect(result.items[0].waitingSinceHours).toBeGreaterThanOrEqual(144);
    expect(result.items[0].whyItMatters).toBeNull();
  });

  it("honours the limit parameter", async () => {
    const deps = depsFor();
    await createNote(deps, "a", {}, OLD);
    await createNote(deps, "b", {}, OLD);
    await createNote(deps, "c", {}, OLD);

    const result = await listReviewQueue(deps, { limit: 2 }, NOW);
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(3);
  });

  it("rejects out-of-range limits", async () => {
    const deps = depsFor();
    await expect(listReviewQueue(deps, { limit: 0 }, NOW)).rejects.toBeInstanceOf(AppError);
    await expect(listReviewQueue(deps, { limit: 999 }, NOW)).rejects.toBeInstanceOf(AppError);
  });

  it("returns an empty queue when no notes are old enough", async () => {
    const deps = depsFor();
    await createNote(deps, "fresh", {}, RECENT);
    const result = await listReviewQueue(deps, {}, NOW);
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});
