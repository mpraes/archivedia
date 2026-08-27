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

/**
 * Optional tags on the request body. Limited to 16 entries to bound the
 * request size; the service normalises further (trim, lowercase, dedupe,
 * max 32 chars per tag) before persisting.
 */
export const noteTagsSchema = z
  .array(z.string().min(1).max(64))
  .max(16, "Too many tags (maximum 16).")
  .optional();

/**
 * Optional "Why does this matter?" answer. Trimmed before validation so
 * whitespace-only inputs are rejected. Capped at the same length as the
 * content body to bound the request payload and DB row size.
 */
export const noteWhyItMattersSchema = z
  .string({ message: "Why-it-matters must be a string when provided." })
  .max(20_000, "Why-it-matters is too long.")
  .optional();

export const createNoteBodySchema = z.object({
  content: noteContentSchema,
  tags: noteTagsSchema,
  whyItMatters: noteWhyItMattersSchema,
});

/**
 * Update supports partial changes: `content` and `tags` are both optional,
 * but at least one must be present so the request cannot be a no-op.
 * Validating "at least one" lives in the service layer because the schema
 * would otherwise need a refinement that complicates the Zod chain.
 */
export const updateNoteBodySchema = z.object({
  content: noteContentSchema.optional(),
  tags: noteTagsSchema,
});

/**
 * Same shape as update: processing a note rewrites its content while
 * transitioning it from `inbox` to `permanent`. Tags are intentionally
 * not editable here — process is a content-only transition.
 */
export const processNoteBodySchema = z.object({
  content: noteContentSchema,
});

/**
 * FR-32: review-time promotion. Both fields are optional individually
 * but content is required (the user must rewrite the note in their
 * own words for it to count as a permanent idea).
 */
export const makePermanentBodySchema = z.object({
  content: noteContentSchema,
  whyItMatters: noteWhyItMattersSchema,
});

/**
 * FR-34: defer review by setting a future `nextReviewAt`. `reason`
 * is optional and currently only used for logs/debugging. We accept it
 * now so clients can record context without changing the wire shape
 * later.
 */
export const deferReviewBodySchema = z.object({
  nextReviewAt: z
    .string({ message: "nextReviewAt is required." })
    .min(1, "nextReviewAt is required.")
    .max(40, "nextReviewAt is too long.")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), {
      message: "nextReviewAt must be a valid ISO 8601 timestamp.",
    }),
  reason: z.string().max(2000).optional(),
});

export const listNotesQuerySchema = z.object({
  date: z.string().optional(),
  timezone: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((value) => (value === undefined ? undefined : Number(value)))
    .pipe(z.number().int().min(1).max(500).optional()),
  q: z.string().min(1).max(200).optional(),
  status: z.enum(["inbox", "permanent", "deleted"]).optional(),
  tag: z.string().min(1).max(64).optional(),
});

/**
 * Query params for the Review queue. `limit` defaults server-side so
 * the front-end can hit `/api/v1/review/notes` with no params and still
 * get a useful response.
 */
export const reviewQueueQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((value) => (value === undefined ? undefined : Number(value)))
    .pipe(z.number().int().min(1).max(200).optional()),
});

/**
 * Phase 2 / Spaces: request schemas. Kept in the existing schema
 * module so controllers stay one-stop and validators stay aligned.
 */
export const createSpaceBodySchema = z.object({
  title: z
    .string({ message: "title is required." })
    .min(1, "title cannot be empty.")
    .max(200, "title is too long."),
  description: z.string().max(2000).optional(),
});

export const updateSpaceBodySchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    status: z.enum(["active", "completed", "archived"]).optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.status !== undefined,
    { message: "Provide at least one of `title`, `description`, or `status`." },
  );

export const listSpacesQuerySchema = z.object({
  includeArchived: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  limit: z
    .string()
    .optional()
    .transform((value) => (value === undefined ? undefined : Number(value)))
    .pipe(z.number().int().min(1).max(200).optional()),
});

/**
 * POST /spaces/:id/notes accepts one of two bodies:
 * - { noteId: "..." } to attach an existing note
 * - { content: "..." } to create a fresh note inside the Space
 * The `kind` discriminator keeps both flows behind one route while
 * letting the controller branch cleanly.
 */
export const addSpaceNoteBodySchema = z.union([
  z.object({
    noteId: z.string().min(1).max(64),
    addedBy: z.enum(["manual", "review"]).optional(),
  }),
  z.object({
    content: z.string().min(1).max(20_000),
    whyItMatters: z.string().max(20_000).optional(),
  }),
]);

// ---------- Phase 3: Canvas ----------

/**
 * Step 3.2 / Phase 3: Canvas schemas. Coords are integers (React Flow
 * defaults to whole pixels) and bounded to keep malformed clients
 * from creating runaway layouts.
 */
const coordSchema = z.number().int().min(-100_000).max(100_000);
const sizeSchema = z.number().int().min(80).max(4_000);

export const createCanvasNodeBodySchema = z
  .object({
    type: z.enum(["note", "text"]),
    noteId: z.string().min(1).max(64).optional(),
    text: z.string().max(2_000).optional(),
    x: coordSchema,
    y: coordSchema,
    width: sizeSchema,
    height: sizeSchema,
    zIndex: z.number().int().min(0).max(10_000).optional(),
  })
  .refine(
    (value) => {
      if (value.type === "note") return Boolean(value.noteId);
      return Boolean(value.text && value.text.trim().length > 0);
    },
    { message: "A note card requires noteId; a text card requires text." },
  );

export const patchCanvasNodeLayoutBodySchema = z
  .object({
    x: coordSchema.optional(),
    y: coordSchema.optional(),
    width: sizeSchema.optional(),
    height: sizeSchema.optional(),
    zIndex: z.number().int().min(0).max(10_000).optional(),
  })
  .refine(
    (value) =>
      value.x !== undefined ||
      value.y !== undefined ||
      value.width !== undefined ||
      value.height !== undefined ||
      value.zIndex !== undefined,
    { message: "Provide at least one of x, y, width, height, or zIndex." },
  );

const handleSchema = z.enum(["top", "right", "bottom", "left"]);

export const createCanvasEdgeBodySchema = z
  .object({
    sourceNodeId: z.string().min(1),
    targetNodeId: z.string().min(1),
    label: z.string().max(64).optional(),
    sourceHandle: handleSchema.nullable().optional(),
    targetHandle: handleSchema.nullable().optional(),
  })
  .refine((value) => value.sourceNodeId !== value.targetNodeId, {
    message: "source and target must be different nodes.",
    path: ["targetNodeId"],
  });

export const patchCanvasViewportBodySchema = z.object({
  x: coordSchema,
  y: coordSchema,
  zoom: z.number().min(0.05).max(8),
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
