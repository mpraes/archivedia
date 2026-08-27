-- v0.7 (requirements_v2): lift the optional "Why does this matter?" answer
-- out of the note content (where it was delimited by an invisible sentinel
-- marker) and store it as a first-class column.
--
-- The column is nullable so old rows that embedded the answer inside
-- `content` keep working unchanged. The list preview will keep stripping
-- the sentinel block for legacy rows; new writes populate the column
-- directly and leave content untouched.
ALTER TABLE "notes"
  ADD COLUMN "why_it_matters" TEXT;
