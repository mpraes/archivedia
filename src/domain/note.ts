import type { NoteStatus } from "./note-status";

/**
 * Domain entity as exposed by services and the API. Persistence concerns
 * stay in repositories; this is the shape the rest of the app sees.
 *
 * `linkedNoteIds` holds the publicIds of every other note referenced by
 * `[[publicId]]` syntax in the content (v0.4). Extracted on save so that
 * backlinks stay cheap even when content grows long.
 *
 * `tags` holds the free-form, case-insensitive tags the user attached
 * to the note (v0.5). Stored normalised (trimmed, lowercased, deduped)
 * to keep filter queries predictable.
 *
 * `whyItMatters` is the optional first-class answer to the capture
 * "Why does this matter?" prompt (v0.7 / requirements_v2). When present
 * it lives separately from `content` so the list preview, exports, and
 * future review tooling can show it without regex tricks.
 *
 * `reference` is the optional source citation (book, link, article,
 * video, etc.) attached to a note (v0.8 / requirements_v3). Free-form
 * text — the user types exactly what they want. Null when no reference
 * was provided.
 *
 * Review lifecycle (v0.7 / FR-27..FR-36):
 * - `processedAt` is set when the note is promoted from `inbox` to
 *   `permanent`. Null while still in the inbox bucket.
 * - `lastReviewedAt` is bumped every time the user engages the note in
 *   the Review page (defer, promote, delete). Null until first touch.
 * - `nextReviewAt` lets the user postpone a note with a deadline; the
 *   Review queue ignores inbox rows whose `nextReviewAt` is still in
 *   the future.
 * - `reviewCount` counts review-page interactions; persistent reminders.
 */
export interface Note {
  readonly id: string;
  readonly publicId: string;
  readonly content: string;
  readonly whyItMatters: string | null;
  readonly reference: string | null;
  readonly status: NoteStatus;
  readonly linkedNoteIds: readonly string[];
  readonly tags: readonly string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly processedAt: Date | null;
  readonly lastReviewedAt: Date | null;
  readonly nextReviewAt: Date | null;
  readonly reviewCount: number;
  readonly deletedAt: Date | null;
}
