-- v0.7 (requirements_v2): widen the notes status enum with `deleted` so
-- soft-deleted rows surface the deletion in the status field itself, not
-- only via the timestamp column. We do not backfill existing rows here:
-- rows with a non-null `deleted_at` are conceptually already deleted,
-- and any future soft-delete will set both columns atomically in the
-- repository layer.
ALTER TYPE "NoteStatus" ADD VALUE 'deleted';
