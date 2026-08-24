import { z } from "zod";
import { AppError } from "@/errors/app-error";

/**
 * Validation helpers for note endpoints. Backend validation is required
 * even when the frontend also validates (NFR-11).
 */
export const noteContentSchema = z
  .string({ message: "Note content is required." })
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(1, "Provide a note containing at least one non-whitespace character.")
      .max(20_000, "Note content is too long."),
  );

export const createNoteBodySchema = z.object({
  content: noteContentSchema,
});

export const updateNoteBodySchema = z.object({
  content: noteContentSchema,
});

/**
 * Same shape as update: processing a note rewrites its content while
 * transitioning it from `inbox` to `permanent`. Schema-level rules are
 * intentionally identical so the service can reuse them.
 */
export const processNoteBodySchema = z.object({
  content: noteContentSchema,
});

export const listNotesQuerySchema = z.object({
  date: z.string().optional(),
  timezone: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((value) => (value === undefined ? undefined : Number(value)))
    .pipe(z.number().int().min(1).max(500).optional()),
});

/**
 * Parse a YYYY-MM-DD date or throw a stable validation error.
 */
export function parseDateParam(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw AppError.invalidDate();
  return value;
}

export type CreateNoteBody = z.infer<typeof createNoteBodySchema>;
export type UpdateNoteBody = z.infer<typeof updateNoteBodySchema>;
export type ProcessNoteBody = z.infer<typeof processNoteBodySchema>;
export type ListNotesQuery = z.infer<typeof listNotesQuerySchema>;
