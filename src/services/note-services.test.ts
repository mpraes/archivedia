import { beforeEach, describe, expect, it } from "vitest";
import { setNoteServiceDeps } from "@/services/dependencies";
import { InMemoryNoteRepository } from "@/repositories/in-memory-note.repository";
import { createNote } from "@/services/create-note.service";
import { getNote } from "@/services/get-note.service";
import { listDailyNotes } from "@/services/list-daily-notes.service";
import { updateNote } from "@/services/update-note.service";
import { deleteNote } from "@/services/delete-note.service";
import { AppError } from "@/errors/app-error";

const TIMEZONE = "America/Sao_Paulo";
const depsFor = () => ({ repository: new InMemoryNoteRepository(), timezone: TIMEZONE });

describe("note services", () => {
  beforeEach(() => setNoteServiceDeps(null));

  it("creates a note with a public id and inbox status", async () => {
    const deps = depsFor();
    const note = await createNote(deps, "hello world", new Date("2026-08-24T14:32:05.000Z"));
    expect(note.publicId).toBe("20260824-1132-001");
    expect(note.status).toBe("inbox");
    expect(note.content).toBe("hello world");
  });

  it("increments the in-minute sequence on subsequent inserts", async () => {
    const deps = depsFor();
    const at = new Date("2026-08-24T14:32:10.000Z");
    const first = await createNote(deps, "first", at);
    const second = await createNote(deps, "second", at);
    expect(first.publicId).toBe("20260824-1132-001");
    expect(second.publicId).toBe("20260824-1132-002");
  });

  it("returns a note by id and throws when missing", async () => {
    const deps = depsFor();
    const note = await createNote(deps, "hello", new Date("2026-08-24T14:32:05.000Z"));
    const fetched = await getNote(deps, note.id);
    expect(fetched.id).toBe(note.id);

    await expect(getNote(deps, "00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it("lists notes for a given day, newest first", async () => {
    const deps = depsFor();
    const morning = new Date("2026-08-24T11:00:00.000Z");
    const afternoon = new Date("2026-08-24T20:00:00.000Z");
    await createNote(deps, "morning", morning);
    await createNote(deps, "afternoon", afternoon);

    const result = await listDailyNotes(deps, { date: "2026-08-24" });
    expect(result.notes.map((n) => n.content)).toEqual(["afternoon", "morning"]);
    expect(result.total).toBe(2);
  });

  it("updates content and bumps updatedAt", async () => {
    const deps = depsFor();
    const at = new Date("2026-08-24T14:32:05.000Z");
    const note = await createNote(deps, "draft", at);
    const updated = await updateNote(deps, note.id, "final", new Date("2026-08-24T15:00:00.000Z"));
    expect(updated.content).toBe("final");
    expect(updated.updatedAt.toISOString()).toBe("2026-08-24T15:00:00.000Z");
    expect(updated.createdAt.toISOString()).toBe("2026-08-24T14:32:05.000Z");
  });

  it("soft-deletes a note and removes it from listings", async () => {
    const deps = depsFor();
    const note = await createNote(deps, "goodbye", new Date("2026-08-24T14:32:05.000Z"));
    await deleteNote(deps, note.id, new Date("2026-08-24T16:00:00.000Z"));

    await expect(getNote(deps, note.id)).rejects.toBeInstanceOf(AppError);
    const list = await listDailyNotes(deps, { date: "2026-08-24" });
    expect(list.notes).toHaveLength(0);
  });

  it("returns the existing note when the same content is saved twice in the same minute bucket", async () => {
    const deps = depsFor();
    const at = new Date("2026-08-24T14:32:05.000Z");
    const first = await createNote(deps, "double tap", at);
    const second = await createNote(deps, "double tap", at);

    expect(second.id).toBe(first.id);
    expect(second.publicId).toBe(first.publicId);
    expect(second.content).toBe(first.content);

    const list = await listDailyNotes(deps, { date: "2026-08-24" });
    expect(list.notes).toHaveLength(1);
  });

  it("creates a new note when the same content is saved in a different minute bucket", async () => {
    const deps = depsFor();
    const first = await createNote(deps, "double tap", new Date("2026-08-24T14:32:05.000Z"));
    const second = await createNote(deps, "double tap", new Date("2026-08-24T14:35:10.000Z"));

    expect(second.id).not.toBe(first.id);
    expect(second.publicId).not.toBe(first.publicId);

    const list = await listDailyNotes(deps, { date: "2026-08-24" });
    expect(list.notes).toHaveLength(2);
  });

  it("ignores soft-deleted notes when deduping", async () => {
    const deps = depsFor();
    const at = new Date("2026-08-24T14:32:05.000Z");
    const first = await createNote(deps, "rebound", at);
    await deleteNote(deps, first.id, new Date("2026-08-24T14:33:00.000Z"));

    const second = await createNote(deps, "rebound", at);

    expect(second.id).not.toBe(first.id);
    expect(second.publicId).not.toBe(first.publicId);

    const list = await listDailyNotes(deps, { date: "2026-08-24" });
    expect(list.notes).toHaveLength(1);
    expect(list.notes[0].id).toBe(second.id);
  });
});
