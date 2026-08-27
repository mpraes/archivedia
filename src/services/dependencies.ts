import type { NoteRepository } from "@/repositories/note.repository";
import type { SpaceRepository } from "@/repositories/space.repository";
import type { SpaceNoteRepository } from "@/repositories/space-note.repository";
import type { CanvasRepository } from "@/repositories/canvas.repository";
import { PostgresNoteRepository } from "@/repositories/postgres-note.repository";
import { PostgresSpaceRepository } from "@/repositories/postgres-space.repository";
import { PostgresSpaceNoteRepository } from "@/repositories/postgres-space-note.repository";
import { PostgresCanvasRepository } from "@/repositories/postgres-canvas.repository";

/**
 * Dependency container for note-related services. Wire it once in app.ts
 * and pass it down so tests can inject a fake repository.
 */
export interface NoteServiceDeps {
  repository: NoteRepository;
  spaceRepository: SpaceRepository;
  spaceNoteRepository: SpaceNoteRepository;
  canvasRepository: CanvasRepository;
  timezone: string;
}

let cachedDeps: NoteServiceDeps | null = null;

export function getNoteServiceDeps(): NoteServiceDeps {
  if (cachedDeps) return cachedDeps;
  const timezone = process.env.APP_TIMEZONE ?? "America/Sao_Paulo";
  cachedDeps = {
    repository: new PostgresNoteRepository(),
    spaceRepository: new PostgresSpaceRepository(),
    spaceNoteRepository: new PostgresSpaceNoteRepository(),
    canvasRepository: new PostgresCanvasRepository(),
    timezone,
  };
  return cachedDeps;
}

/** Test-only: allow swapping the singleton for an in-memory fake. */
export function setNoteServiceDeps(deps: NoteServiceDeps | null): void {
  cachedDeps = deps;
}
