/**
 * Space status. Phase 2 / requirements_v2:
 *
 * - `active` is the default for a Space the user is currently working
 *   in; the Spaces page lists these first.
 * - `completed` marks a Space that has reached a stable conclusion
 *   (a finished article, a shipped investigation) but stays visible
 *   for reference.
 * - `archived` is a soft-hide that drops the Space from the default
 *   list without deleting its note associations.
 *
 * The `kind` discriminator (`project | topic | article | research`)
 * from the spec exists conceptually for future filtering but is not
 * yet persisted — every Space is just a Space today.
 */
export type SpaceStatus = "active" | "completed" | "archived";

export type SpaceKind = "project" | "topic" | "article" | "research";

/**
 * Domain entity for a Space. Persistence concerns stay in the
 * repository layer; this is the shape the rest of the app sees.
 */
export interface Space {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: SpaceStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
