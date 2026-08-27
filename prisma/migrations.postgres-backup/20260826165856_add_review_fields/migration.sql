-- v0.7 (requirements_v2): track the review lifecycle on each note so the
-- Review page can show an honest "what's waiting" queue.
--
-- All four columns are additive with safe defaults so the migration is
-- non-breaking for any rows that pre-existed:
--
-- - processed_at       — set the moment a note is promoted to permanent.
-- - last_reviewed_at   — bumped every time the user looks at a note
--                        during review (defer, dismiss, promote, delete).
-- - next_review_at     — explicit "remind me again" deadline for inbox
--                        notes that the user postponed.
-- - review_count       — how many times the user has interacted with the
--                        note in review; the list view can highlight
--                        chronically-revisited notes later.
--
-- A composite (status, next_review_at) index makes the "needs review"
-- query O(matches) instead of O(table), which matters as the archive grows.
ALTER TABLE "notes"
  ADD COLUMN "processed_at" TIMESTAMPTZ,
  ADD COLUMN "last_reviewed_at" TIMESTAMPTZ,
  ADD COLUMN "next_review_at" TIMESTAMPTZ,
  ADD COLUMN "review_count" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "idx_notes_review_queue"
  ON "notes" ("status", "next_review_at");
