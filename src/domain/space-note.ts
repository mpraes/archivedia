import type { Space } from "./space";

/**
 * Provenance for a Space membership. The doc (§"SpaceNote") defines
 * three intents and we keep all three so future analytics can
 * distinguish a deliberate move ("manual", "created-in-space") from
 * an incidental one ("review"). The wire value uses a hyphenated
 * `created-in-space` to match the spec; the DB column uses the
 * snake_case `created_in_space` via Prisma's `@map`.
 */
export type SpaceNoteAddedBy = "manual" | "review" | "created-in-space";

/**
 * Membership of a Note in a Space. The composite primary key on
 * (spaceId, noteId) makes adding the same note to the same Space a
 * no-op. `addedAt` lets the Space view sort its membership list
 * chronologically without a separate audit table.
 */
export interface SpaceNote {
  readonly spaceId: Space["id"];
  readonly noteId: string;
  readonly addedAt: Date;
  readonly addedBy: SpaceNoteAddedBy;
}
