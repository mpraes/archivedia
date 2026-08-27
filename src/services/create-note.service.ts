import type { Note } from "@/domain/note";
import { AppError } from "@/errors/app-error";
import { logDbFailure } from "@/lib/logger";
import { extractLinkedNoteIds } from "@/lib/note-links";
import { formatPublicIdStem, minuteBucket } from "@/lib/public-note-id";
import { normaliseTags } from "@/lib/note-links";
import type { NoteServiceDeps } from "./dependencies";

/**
 * Produce a unique YYYYMMDD-HHmm-SSS public id by probing the repository
 * for existing ids in the same minute bucket and using count+1 as the
 * sequence. A random-suffix fallback covers the unlikely race when two
 * inserts in the same minute both see the same count.
 *
 * Before allocating a new id, look up an active note with the exact same
 * content in the same minute bucket and return it unchanged. This absorbs
 * accidental double-saves (e.g. rapid Ctrl/Cmd+Enter) without producing a
 * duplicate row.
 *
 * v0.4 also extracts `[[publicId]]` references from the content; v0.5
 * normalises the optional tag list.
 */
export async function createNote(
  deps: NoteServiceDeps,
  content: string,
  options: { tags?: string[]; whyItMatters?: string | null } = {},
  now: Date = new Date(),
): Promise<Note> {
  const bucket = minuteBucket(now, deps.timezone);
  const bucketPrefix = `${bucket}-`;

  const dup = await deps.repository.findActiveByContentInBucketPrefix(content, bucketPrefix);
  if (dup) return dup;

  const existing = await deps.repository.countByPublicIdPrefix(bucketPrefix);
  const sequence = existing + 1;
  const publicId = formatPublicIdStem(now, deps.timezone, sequence);
  const tags = normaliseTags(options.tags);
  const linkedNoteIds = extractLinkedNoteIds(content);

  try {
    return await deps.repository.insert({
      publicId,
      content,
      whyItMatters: options.whyItMatters ?? null,
      linkedNoteIds,
      tags,
      createdAt: now,
    });
  } catch (err) {
    logDbFailure({ component: "create_note", op: "insert", err, publicId });
    const fallback = `${publicId}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    try {
      return await deps.repository.insert({
        publicId: fallback,
        content,
        whyItMatters: options.whyItMatters ?? null,
        linkedNoteIds,
        tags,
        createdAt: now,
      });
    } catch (fallbackErr) {
      logDbFailure({ component: "create_note", op: "insert_fallback", err: fallbackErr, fallback });
      throw AppError.databaseUnavailable();
    }
  }
}
