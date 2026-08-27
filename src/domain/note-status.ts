/**
 * Note status.
 *
 * - `inbox` is the default capture bucket (FR-01).
 * - `permanent` is the durable archive promoted via review.
 * - `deleted` is a soft-delete sentinel paired with `deletedAt`. Listing
 *   queries already filter on `deletedAt IS NULL`, so the value is mostly
 *   a documentation aid for clients and for future "Recently deleted"
 *   tooling (requirements_v2, §"Decisão 4").
 */
export type NoteStatus = "inbox" | "permanent" | "deleted";
