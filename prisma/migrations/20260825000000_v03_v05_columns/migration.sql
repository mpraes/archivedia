-- v0.3 + v0.4 + v0.5: extend notes with link extraction storage and free-form tags.
-- Both columns are additive with safe defaults so the migration is non-breaking
-- for any rows that pre-existed. GIN indexes make backlinks and tag filtering
-- cheap as the table grows.
ALTER TABLE "notes"
  ADD COLUMN "linked_note_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "notes"
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "idx_notes_linked_note_ids"
  ON "notes" USING GIN ("linked_note_ids");

CREATE INDEX "idx_notes_tags"
  ON "notes" USING GIN ("tags");

-- Drop and re-add the status check to widen beyond 'inbox' + 'permanent'
-- if needed later; the current values are still enforced by the enum.
-- (kept for documentation; no-op today)
-- ALTER TABLE "notes" DROP CONSTRAINT "notes_status_valid";
-- ALTER TABLE "notes" ADD CONSTRAINT "notes_status_valid"
--   CHECK (status IN ('inbox', 'permanent'));
