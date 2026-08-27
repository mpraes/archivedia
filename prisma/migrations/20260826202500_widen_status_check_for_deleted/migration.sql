-- Widen the defensive `notes_status_valid` CHECK constraint to accept the
-- `deleted` enum value that `20260826165506_add_deleted_status` introduced.
-- The repository's `softDelete` writes `'deleted'` to `status` alongside
-- `deleted_at`, so the constraint must allow it; otherwise the UPDATE fails
-- with Postgres error 23514 even though the enum itself accepts the value.
-- This is a defence-in-depth mirror of the enum, kept in sync manually
-- because Prisma's schema language cannot express CHECK constraints.
ALTER TABLE "notes" DROP CONSTRAINT "notes_status_valid";
ALTER TABLE "notes"
  ADD CONSTRAINT "notes_status_valid"
  CHECK (status IN ('inbox', 'permanent', 'deleted'));
