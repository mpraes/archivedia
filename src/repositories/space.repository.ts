import type { Space } from "@/domain/space";
import type { SpaceStatus } from "@/domain/space";

/**
 * Patch shape for Space updates. All fields are optional; the
 * service rejects an empty patch with a 422.
 */
export interface SpacePatch {
  title?: string;
  description?: string | null;
  status?: SpaceStatus;
}

/**
 * Repository contract for Spaces. Concrete implementations live next
 * to this file (Postgres-backed) or in tests (in-memory fake).
 */
export interface SpaceRepository {
  insert(input: {
    title: string;
    description: string | null;
    now: Date;
  }): Promise<Space>;
  findById(id: string): Promise<Space | null>;
  /** Most-recently-updated first. Excludes `archived` by default. */
  list(input: { includeArchived: boolean; limit: number }): Promise<Space[]>;
  /** Cheap COUNT(*) grouped by status — drives the Spaces page summary. */
  countByStatus(): Promise<Record<SpaceStatus, number>>;
  /** Note associations for a single Space, newest first. */
  countNotes(spaceId: string): Promise<number>;
  patch(id: string, patch: SpacePatch, updatedAt: Date): Promise<Space | null>;
}
