import type { Note } from "@/domain/note";
import { AppError } from "@/errors/app-error";
import { logDbFailure } from "@/lib/logger";
import { hoursWaitingSince } from "@/lib/format";
import type { NoteServiceDeps } from "./dependencies";

/**
 * Lightweight DTO for the Review queue. Mirrors the shape documented in
 * requirements_v2 (FR-31): publicId, content, whyItMatters, the
 * review-relevant timestamps, and how long the note has been waiting.
 * Keeping it separate from `NoteDto` lets us drop internal columns
 * (linkedNoteIds, tags) the Review page does not need.
 */
export interface ReviewQueueItem {
  id: string;
  publicId: string;
  content: string;
  whyItMatters: string | null;
  status: "inbox";
  createdAt: string;
  updatedAt: string;
  reviewCount: number;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  waitingSinceHours: number;
}

function toQueueItem(note: Note, now: Date): ReviewQueueItem {
  return {
    id: note.id,
    publicId: note.publicId,
    content: note.content,
    whyItMatters: note.whyItMatters,
    status: "inbox",
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    reviewCount: note.reviewCount,
    lastReviewedAt: note.lastReviewedAt ? note.lastReviewedAt.toISOString() : null,
    nextReviewAt: note.nextReviewAt ? note.nextReviewAt.toISOString() : null,
    waitingSinceHours: hoursWaitingSince(note.createdAt, now),
  };
}

export interface ReviewQueueResult {
  items: ReviewQueueItem[];
  /** Total eligible notes regardless of `limit`. */
  total: number;
}

/**
 * FR-30 / FR-31: list inbox notes that pass the 48-hour review gate.
 * `limit` defaults to 50 so a single request can drive the page's
 * "queue size" badge and the first card without a second roundtrip.
 */
export async function listReviewQueue(
  deps: NoteServiceDeps,
  input: { limit?: number } = {},
  now: Date = new Date(),
): Promise<ReviewQueueResult> {
  const limit = input.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw AppError.validation({ limit: "Limit must be an integer between 1 and 200." });
  }
  try {
    const [rows, total] = await Promise.all([
      deps.repository.listReviewQueue({ limit, now }),
      deps.repository.countReviewQueue(now),
    ]);
    return { items: rows.map((note) => toQueueItem(note, now)), total };
  } catch (err) {
    logDbFailure({ component: "review_queue", op: "list", err });
    throw AppError.databaseUnavailable();
  }
}
