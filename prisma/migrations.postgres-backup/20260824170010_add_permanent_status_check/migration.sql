-- Extend the defensive CHECK constraint on `notes.status` to mirror the
-- wider enum after `20260824170000_add_permanent_status` has committed
-- the `permanent` value. Splitting the DDL into its own migration keeps
-- each transaction free of cross-statement references to a not-yet-
-- committed enum value.
ALTER TABLE "notes" DROP CONSTRAINT "notes_status_valid";
ALTER TABLE "notes"
  ADD CONSTRAINT "notes_status_valid"
  CHECK (status IN ('inbox', 'permanent'));
