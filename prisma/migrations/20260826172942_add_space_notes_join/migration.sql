-- v0.7 / Phase 2 (requirements_v2): join table that links notes to
-- spaces. A note can belong to multiple Spaces (FR-40) so the primary
-- key is the composite (space_id, note_id); adding the same note to
-- the same Space twice is a no-op.
--
-- Columns:
--
-- - space_id  — FK to spaces; deleting a Space cascades and detaches
--               all of its note associations.
-- - note_id   — FK to notes; soft-deleting a note leaves the row in
--               place so the Space can still show a "removed" marker
--               later. The cascade here only fires on hard delete.
-- - added_at  — when the note joined this Space; lets the Space view
--               sort its membership list chronologically.
-- - added_by  — provenance: did the user add it manually, did the
--               Review page route it here, or was it created inside
--               the Space? Stored as an enum so future analytics can
--               distinguish intent.
--
-- Two indexes:
-- - (space_id, added_at DESC) powers the "Notes in this Space" listing.
-- - (note_id) powers the inverse "Spaces that contain this note" view.
CREATE TYPE "SpaceNoteAddedBy" AS ENUM (
  'manual',
  'review',
  'created-in-space'
);

CREATE TABLE "space_notes" (
  "space_id" UUID               NOT NULL,
  "note_id"  UUID               NOT NULL,
  "added_at" TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "added_by" "SpaceNoteAddedBy" NOT NULL DEFAULT 'manual',
  CONSTRAINT "space_notes_pkey" PRIMARY KEY ("space_id", "note_id"),
  CONSTRAINT "space_notes_space_id_fkey" FOREIGN KEY ("space_id")
    REFERENCES "spaces"("id") ON DELETE CASCADE,
  CONSTRAINT "space_notes_note_id_fkey" FOREIGN KEY ("note_id")
    REFERENCES "notes"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_space_notes_space_added"
  ON "space_notes" ("space_id", "added_at" DESC);

CREATE INDEX "idx_space_notes_note"
  ON "space_notes" ("note_id");
