import type { NoteRepository } from "@/repositories/note.repository";
import { PostgresNoteRepository } from "@/repositories/postgres-note.repository";

/**
 * Dependency container for note-related services. Wire it once in app.ts
 * and pass it down so tests can inject a fake repository.
 */
export interface NoteServiceDeps {
  repository: NoteRepository;
  timezone: string;
}

let cachedDeps: NoteServiceDeps | null = null;

export function getNoteServiceDeps(): NoteServiceDeps {
  if (cachedDeps) return cachedDeps;
  const timezone = process.env.APP_TIMEZONE ?? "America/Sao_Paulo";
  cachedDeps = {
    repository: new PostgresNoteRepository(),
    timezone,
  };
  return cachedDeps;
}

/** Test-only: allow swapping the singleton for an in-memory fake. */
export function setNoteServiceDeps(deps: NoteServiceDeps | null): void {
  cachedDeps = deps;
}
