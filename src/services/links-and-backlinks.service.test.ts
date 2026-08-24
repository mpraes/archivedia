import { beforeEach, describe, expect, it } from "vitest";
import { setNoteServiceDeps } from "@/services/dependencies";
import { InMemoryNoteRepository } from "@/repositories/in-memory-note.repository";
import { createNote } from "@/services/create-note.service";
import { updateNote } from "@/services/update-note.service";
import { processNote } from "@/services/process-note.service";
import { getBacklinks } from "@/services/backlinks.service";

const TIMEZONE = "America/Sao_Paulo";
const depsFor = () => ({ repository: new InMemoryNoteRepository(), timezone: TIMEZONE });

describe("wiki-links + backlinks (v0.4)", () => {
  beforeEach(() => setNoteServiceDeps(null));

  it("extracts `[[publicId]]` references on create", async () => {
    const deps = depsFor();
    const target = await createNote(
      deps,
      "target",
      {},
      new Date("2026-08-24T14:32:05.000Z"),
    );
    const source = await createNote(
      deps,
      `see [[${target.publicId}]] for context`,
      {},
      new Date("2026-08-24T15:00:00.000Z"),
    );
    expect(source.linkedNoteIds).toEqual([target.publicId]);
  });

  it("re-extracts links when content is updated", async () => {
    const deps = depsFor();
    const target = await createNote(deps, "t", {}, new Date("2026-08-24T14:32:05.000Z"));
    const note = await createNote(deps, "first draft", {}, new Date("2026-08-24T14:35:05.000Z"));

    const updated = await updateNote(
      deps,
      note.id,
      { content: `now links to [[${target.publicId}]]` },
      new Date("2026-08-24T15:00:00.000Z"),
    );
    expect(updated.linkedNoteIds).toEqual([target.publicId]);

    const cleared = await updateNote(
      deps,
      note.id,
      { content: "no more links here" },
      new Date("2026-08-24T15:30:00.000Z"),
    );
    expect(cleared.linkedNoteIds).toEqual([]);
  });

  it("re-extracts links on process (inbox → permanent)", async () => {
    const deps = depsFor();
    const target = await createNote(deps, "t", {}, new Date("2026-08-24T14:32:05.000Z"));
    const inbox = await createNote(deps, "draft", {}, new Date("2026-08-24T14:35:05.000Z"));

    const processed = await processNote(
      deps,
      inbox.id,
      `now permanent and links [[${target.publicId}]]`,
      new Date("2026-08-24T15:00:00.000Z"),
    );

    expect(processed.status).toBe("permanent");
    expect(processed.linkedNoteIds).toEqual([target.publicId]);
  });

  it("getBacklinks returns all notes that reference the target publicId", async () => {
    const deps = depsFor();
    const target = await createNote(deps, "t", {}, new Date("2026-08-24T14:32:05.000Z"));
    await createNote(
      deps,
      `links [[${target.publicId}]]`,
      {},
      new Date("2026-08-24T15:00:00.000Z"),
    );
    await createNote(
      deps,
      `also [[${target.publicId}]] somewhere`,
      {},
      new Date("2026-08-24T16:00:00.000Z"),
    );
    await createNote(
      deps,
      "no link here",
      {},
      new Date("2026-08-24T17:00:00.000Z"),
    );

    const backlinks = await getBacklinks(deps, target.id);
    expect(backlinks).toHaveLength(2);
    expect(backlinks.every((n) => n.linkedNoteIds.includes(target.publicId))).toBe(true);
  });

  it("getBacklinks resolves the target by publicId", async () => {
    const deps = depsFor();
    const target = await createNote(deps, "t", {}, new Date("2026-08-24T14:32:05.000Z"));
    await createNote(
      deps,
      `[[${target.publicId}]]`,
      {},
      new Date("2026-08-24T15:00:00.000Z"),
    );
    const backlinks = await getBacklinks(deps, target.publicId);
    expect(backlinks).toHaveLength(1);
  });

  it("getBacklinks returns 404 for a missing target", async () => {
    const deps = depsFor();
    await expect(getBacklinks(deps, "nope")).rejects.toMatchObject({
      code: "NOTE_NOT_FOUND",
      status: 404,
    });
  });
});
