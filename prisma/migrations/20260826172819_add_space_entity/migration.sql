-- v0.7 / Phase 2 (requirements_v2): introduce Spaces as the unit of
-- organisation that lets the user gather notes around a project,
-- topic, article or investigation. A Space is purely a container —
-- notes live in the existing notes table and join in via the
-- space_notes table added in the next migration.
--
-- We keep the schema intentionally minimal here:
--
-- - id           — internal UUID, matches the notes table.
-- - title        — human label shown on cards and in the nav.
-- - description  — optional one-paragraph context (can be null).
-- - status       — active / completed / archived, so a finished
--                  Space can be hidden from the default list view
--                  without losing history.
-- - created_at /
--   updated_at   — same convention as notes.
--
-- A composite index on (status, updated_at DESC) keeps the Spaces
-- listing query cheap as the archive grows.
CREATE TYPE "SpaceStatus" AS ENUM ('active', 'completed', 'archived');

CREATE TABLE "spaces" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "title"       VARCHAR(200) NOT NULL,
  "description" TEXT,
  "status"      "SpaceStatus" NOT NULL DEFAULT 'active',
  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "spaces_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_spaces_status_updated"
  ON "spaces" ("status", "updated_at" DESC);
