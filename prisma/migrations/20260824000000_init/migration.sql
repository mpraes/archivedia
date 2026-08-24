-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "NoteStatus" AS ENUM ('inbox');

-- CreateTable
CREATE TABLE "notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_id" VARCHAR(64) NOT NULL,
    "content" TEXT NOT NULL,
    "status" "NoteStatus" NOT NULL DEFAULT 'inbox',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notes_public_id_key" ON "notes"("public_id");

-- CreateIndex
CREATE INDEX "idx_notes_created_at" ON "notes"("created_at" DESC);

-- CreateIndex (active-notes-only partial index, not expressible in Prisma schema)
CREATE INDEX "idx_notes_active_created_at"
  ON "notes" ("created_at" DESC)
  WHERE "deleted_at" IS NULL;

-- Domain CHECK constraints from requirements (defence in depth on top of
-- Zod validation). Both are not expressible in Prisma's schema language.
ALTER TABLE "notes"
  ADD CONSTRAINT "notes_content_not_blank"
    CHECK (length(trim("content")) > 0);

ALTER TABLE "notes"
  ADD CONSTRAINT "notes_status_valid"
    CHECK ("status" IN ('inbox'));
