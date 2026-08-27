-- Add 'permanent' to the NoteStatus enum so the v0.2 inbox-review workflow
-- can promote a fleeting note into a self-contained permanent note.
--
-- This file MUST stay in its own migration: Postgres 12+ allows
-- `ALTER TYPE ... ADD VALUE` inside a transaction block, but the new
-- value cannot be referenced by any DDL in the same transaction (the
-- `55P04 unsafe use of new value` error). The follow-up CHECK constraint
-- lives in a separate migration that runs after this one commits.
ALTER TYPE "NoteStatus" ADD VALUE 'permanent';
