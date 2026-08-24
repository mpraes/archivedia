-- Add 'permanent' to the NoteStatus enum so the v0.2 inbox-review workflow
-- can promote a fleeting note into a self-contained permanent note.
-- ALTER TYPE ... ADD VALUE is supported inside a transaction block in
-- Postgres 12+, which is the floor implied by the pgcrypto requirement.
ALTER TYPE "NoteStatus" ADD VALUE 'permanent';

-- Extend the defensive CHECK constraint to mirror the wider enum.
-- Postgres does not let us rename a CHECK in place; drop and re-add.
ALTER TABLE "notes" DROP CONSTRAINT "notes_status_valid";
ALTER TABLE "notes"
  ADD CONSTRAINT "notes_status_valid"
  CHECK (status IN ('inbox', 'permanent'));
