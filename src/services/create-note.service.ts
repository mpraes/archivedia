import type { Note } from "@/domain/note";
import { AppError } from "@/errors/app-error";
import { formatPublicIdStem, minuteBucket } from "@/lib/public-note-id";
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
 */
export async function createNote(
  deps: NoteServiceDeps,
  content: string,
  now: Date = new Date(),
): Promise<Note> {
  const bucket = minuteBucket(now, deps.timezone);
  const bucketPrefix = `${bucket}-`;

  const dup = await deps.repository.findActiveByContentInBucketPrefix(content, bucketPrefix);
  if (dup) return dup;

  const existing = await deps.repository.countByPublicIdPrefix(bucketPrefix);
  const sequence = existing + 1;
  const publicId = formatPublicIdStem(now, deps.timezone, sequence);

  try {
    return await deps.repository.insert({ publicId, content, createdAt: now });
  } catch {
    const fallback = `${publicId}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    try {
      return await deps.repository.insert({ publicId: fallback, content, createdAt: now });
    } catch {
      throw AppError.databaseUnavailable();
    }
  }
}
