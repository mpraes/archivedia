/**
 * Wiki-link parsing for the v0.4 linking layer.
 *
 * Matches `[[publicId]]` inside note content. The captured token is
 * expected to be the target note's human-readable publicId in the
 * `YYYYMMDD-HHmm-SSS` shape, but the parser is permissive about the
 * exact format and just preserves whatever appears between the brackets
 * (trimmed, single-spaced). The caller decides how to validate or
 * resolve each token.
 *
 * Examples (matched → captured):
 *   "see [[20260824-1132-001]]"        → ["20260824-1132-001"]
 *   "[[20260824-1132-001]] and [[foo]]" → ["20260824-1132-001", "foo"]
 *   "[[ spaced  ]]"                    → ["spaced"]
 *   "no links here"                    → []
 *
 * Pure function — no I/O, no allocation on the hot path beyond the
 * returned array. Safe to call from request handlers.
 */
const LINK_PATTERN = /\[\[([^\[\]\n]+)\]\]/g;

export function extractLinkedNoteIds(content: string): string[] {
  if (!content) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  // The regex is stateless between calls; resetting lastIndex keeps the
  // function safe under repeated invocations.
  LINK_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LINK_PATTERN.exec(content)) !== null) {
    const token = normaliseToken(match[1]);
    if (!token) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

function normaliseToken(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  return trimmed;
}

/**
 * Parse and validate a free-form tag input. Tags are case-insensitive,
 * trimmed, and capped at 32 characters to keep UI chips short and to
 * bound storage size.
 *
 * Returns the normalised, deduplicated, order-preserving list. Empty
 * input yields an empty list — never throws.
 */
export function normaliseTags(input: readonly string[] | undefined | null): string[] {
  if (!input) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed) continue;
    if (trimmed.length > 32) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}
