import { beforeEach, describe, expect, it } from "vitest";
import { setNoteServiceDeps } from "@/services/dependencies";
import { InMemoryNoteRepository } from "@/repositories/in-memory-note.repository";
import {
  InMemorySpaceRepository,
  InMemorySpaceNoteRepository,
} from "@/repositories/in-memory-space.repository";
import { InMemoryCanvasRepository } from "@/repositories/in-memory-canvas.repository";
import { createNote } from "@/services/create-note.service";
import { createSpace } from "@/services/spaces.service";
import {
  addCanvasEdge,
  addCanvasNode,
  getCanvasBundle,
  patchCanvasNodeLayout,
  patchCanvasViewport,
  removeCanvasEdge,
  removeCanvasNode,
} from "@/services/canvas.service";
import { AppError } from "@/errors/app-error";

const TIMEZONE = "America/Sao_Paulo";
const depsFor = () => ({
  repository: new InMemoryNoteRepository(),
  spaceRepository: new InMemorySpaceRepository(),
  spaceNoteRepository: new InMemorySpaceNoteRepository(),
  canvasRepository: new InMemoryCanvasRepository(),
  timezone: TIMEZONE,
});

describe("canvas service", () => {
  beforeEach(() => setNoteServiceDeps(null));

  it("lazily creates a canvas on first access and returns the bundle", async () => {
    const deps = depsFor();
    const space = await createSpace(deps, { title: "DE Patterns" });
    const bundle = await getCanvasBundle(deps, space.id);
    expect(bundle.canvas.spaceId).toBe(space.id);
    expect(bundle.canvas.name).toBe("Main canvas");
    expect(bundle.canvas.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(bundle.nodes).toEqual([]);
    expect(bundle.edges).toEqual([]);

    // Second call returns the same canvas (no duplicate).
    const second = await getCanvasBundle(deps, space.id);
    expect(second.canvas.id).toBe(bundle.canvas.id);
  });

  it("rejects unknown space ids", async () => {
    const deps = depsFor();
    await expect(
      getCanvasBundle(deps, "00000000-0000-0000-0000-000000000000"),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("persists viewport patches", async () => {
    const deps = depsFor();
    const space = await createSpace(deps, { title: "x" });
    await patchCanvasViewport(
      deps,
      space.id,
      { x: -120, y: 240, zoom: 1.5 },
      new Date("2026-08-26T12:00:00.000Z"),
    );
    const bundle = await getCanvasBundle(deps, space.id);
    expect(bundle.canvas.viewport).toEqual({ x: -120, y: 240, zoom: 1.5 });
  });

  it("adds note-cards and text-cards, rejecting mismatched types", async () => {
    const deps = depsFor();
    const space = await createSpace(deps, { title: "x" });
    const note = await createNote(
      deps,
      "investigate UPSERT",
      {},
      new Date("2026-08-20T12:00:00.000Z"),
    );
    const noteNode = await addCanvasNode(
      deps,
      space.id,
      {
        type: "note",
        noteId: note.id,
        x: 40,
        y: 80,
        width: 320,
        height: 180,
        zIndex: 0,
      },
      new Date("2026-08-26T12:00:00.000Z"),
    );
    expect(noteNode.type).toBe("note");
    expect(noteNode.noteId).toBe(note.id);
    expect(noteNode.text).toBeNull();

    const textNode = await addCanvasNode(
      deps,
      space.id,
      {
        type: "text",
        text: "Question: Fabric or custom pipeline?",
        x: 400,
        y: 80,
        width: 320,
        height: 160,
        zIndex: 0,
      },
      new Date("2026-08-26T12:00:00.000Z"),
    );
    expect(textNode.type).toBe("text");
    expect(textNode.noteId).toBeNull();
    expect(textNode.text).toBe("Question: Fabric or custom pipeline?");
  });

  it("rejects a note-card without a real noteId", async () => {
    const deps = depsFor();
    const space = await createSpace(deps, { title: "x" });
    await expect(
      addCanvasNode(deps, space.id, {
        type: "note",
        noteId: "00000000-0000-0000-0000-000000000000",
        x: 0,
        y: 0,
        width: 320,
        height: 180,
        zIndex: 0,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("patches node layout", async () => {
    const deps = depsFor();
    const space = await createSpace(deps, { title: "x" });
    const note = await createNote(
      deps,
      "x",
      {},
      new Date("2026-08-20T12:00:00.000Z"),
    );
    const node = await addCanvasNode(deps, space.id, {
      type: "note",
      noteId: note.id,
      x: 10,
      y: 20,
      width: 320,
      height: 180,
      zIndex: 0,
    });
    const updated = await patchCanvasNodeLayout(
      deps,
      space.id,
      node.id,
      { x: 100, y: 200 },
      new Date("2026-08-26T12:00:00.000Z"),
    );
    expect(updated.x).toBe(100);
    expect(updated.y).toBe(200);
    // Unchanged fields stay put.
    expect(updated.width).toBe(320);
    expect(updated.height).toBe(180);
  });

  it("rejects self-loop edges and edges with non-existent endpoints", async () => {
    const deps = depsFor();
    const space = await createSpace(deps, { title: "x" });
    const note = await createNote(
      deps,
      "x",
      {},
      new Date("2026-08-20T12:00:00.000Z"),
    );
    const a = await addCanvasNode(deps, space.id, {
      type: "note",
      noteId: note.id,
      x: 0,
      y: 0,
      width: 320,
      height: 180,
      zIndex: 0,
    });
    const b = await addCanvasNode(deps, space.id, {
      type: "text",
      text: "hypothesis",
      x: 400,
      y: 0,
      width: 320,
      height: 160,
      zIndex: 0,
    });
    await expect(
      addCanvasEdge(deps, space.id, { sourceNodeId: a.id, targetNodeId: a.id }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      addCanvasEdge(deps, space.id, {
        sourceNodeId: a.id,
        targetNodeId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toBeInstanceOf(AppError);

    const ok = await addCanvasEdge(deps, space.id, {
      sourceNodeId: a.id,
      targetNodeId: b.id,
      label: "supports",
    });
    expect(ok.label).toBe("supports");
  });

  it("cascades edge deletion when a node is removed", async () => {
    const deps = depsFor();
    const space = await createSpace(deps, { title: "x" });
    const note = await createNote(
      deps,
      "x",
      {},
      new Date("2026-08-20T12:00:00.000Z"),
    );
    const a = await addCanvasNode(deps, space.id, {
      type: "note",
      noteId: note.id,
      x: 0,
      y: 0,
      width: 320,
      height: 180,
      zIndex: 0,
    });
    const b = await addCanvasNode(deps, space.id, {
      type: "text",
      text: "hypothesis",
      x: 400,
      y: 0,
      width: 320,
      height: 160,
      zIndex: 0,
    });
    const edge = await addCanvasEdge(deps, space.id, {
      sourceNodeId: a.id,
      targetNodeId: b.id,
    });
    await removeCanvasNode(deps, space.id, a.id);
    await expect(removeCanvasEdge(deps, space.id, edge.id)).rejects.toBeInstanceOf(AppError);
  });
});
