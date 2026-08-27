-- v0.8 (requirements_v3): add an optional "reference" column so the
-- user can cite the source of a note — book, link, article, video, or
-- any other free-form citation. Mirrors the why_it_matters addition:
-- nullable TEXT so existing rows stay untouched, normalised to NULL
-- when empty so the list previews stay clean.
ALTER TABLE "notes"
  ADD COLUMN "reference" TEXT;
