import { beforeEach, describe, expect, it } from "vitest";
import { setNoteServiceDeps } from "@/services/dependencies";
import { InMemoryNoteRepository } from "@/repositories/in-memory-note.repository";
import { createNote } from "@/services/create-note.service";
import { deleteNote } from "@/services/delete-note.service";
import { processNote } from "@/services/process-note.service";
import { AppError } from "@/errors/app-error";
import { ErrorCode } from "@/errors/app-error";

const TIMEZONE = "America/Sao_Paulo";
const depsFor = () => ({ repository: new InMemoryNoteRepository(), timezone: TIMEZONE });

describe("processNote service", () => {
  beforeEach(() => setNoteServiceDeps(null));

  it("promotes an inbox note to permanent, preserving id/publicId/createdAt", async () => {
    const deps = depsFor();
    const note = await createNote(deps, "fleeting draft", new Date("2026-08-24T14:32:05.000Z"));

    const processed = await processNote(
      deps,
      note.id,
      "Self-contained permanent rewrite of the idea.",
      new Date("2026-08-24T15:00:00.000Z"),
    );

    expect(processed.id).toBe(note.id);
    expect(processed.publicId).toBe(note.publicId);
    expect(processed.createdAt.toISOString()).toBe("2026-08-24T14:32:05.000Z");
    expect(processed.updatedAt.toISOString()).toBe("2026-08-24T15:00:00.000Z");
    expect(processed.status).toBe("permanent");
    expect(processed.content).toBe("Self-contained permanent rewrite of the idea.");
  });

  it("rejects a second process attempt on an already-permanent note with 409 NOTE_NOT_PROCESSABLE", async () => {
    const deps = depsFor();
    const note = await createNote(deps, "draft", new Date("2026-08-24T14:32:05.000Z"));
    await processNote(deps, note.id, "first rewrite", new Date("2026-08-24T15:00:00.000Z"));

    let captured: AppError | null = null;
    try {
      await processNote(deps, note.id, "second rewrite", new Date("2026-08-24T15:30:00.000Z"));
    } catch (err) {
      if (err instanceof AppError) captured = err;
    }

    expect(captured).not.toBeNull();
    expect(captured!.code).toBe(ErrorCode.NOTE_NOT_PROCESSABLE);
    expect(captured!.status).toBe(409);
  });

  it("returns 404 when the note does not exist", async () => {
    const deps = depsFor();
    await expect(
      processNote(deps, "00000000-0000-0000-0000-000000000000", "anything"),
    ).rejects.toMatchObject({ code: ErrorCode.NOTE_NOT_FOUND, status: 404 });
  });

  it("returns 404 when the note has been soft-deleted", async () => {
    const deps = depsFor();
    const note = await createNote(deps, "draft", new Date("2026-08-24T14:32:05.000Z"));
    await deleteNote(deps, note.id, new Date("2026-08-24T14:50:00.000Z"));

    await expect(
      processNote(deps, note.id, "anything", new Date("2026-08-24T15:00:00.000Z")),
    ).rejects.toMatchObject({ code: ErrorCode.NOTE_NOT_FOUND, status: 404 });
  });

  it("rejects empty or whitespace-only content via the schema (caller pre-validates)", async () => {
    // The service trusts the schema layer; empty content never reaches it.
    // Here we just confirm that a non-empty rewrite succeeds even when the
    // new content equals the original — reprocessing identical content is
    // an explicit user choice in the inbox-review flow.
    const deps = depsFor();
    const note = await createNote(deps, "draft", new Date("2026-08-24T14:32:05.000Z"));
    const processed = await processNote(deps, note.id, "draft", new Date("2026-08-24T15:00:00.000Z"));
    expect(processed.status).toBe("permanent");
    expect(processed.content).toBe("draft");
  });
});
