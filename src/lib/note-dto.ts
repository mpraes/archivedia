import type { Note } from "@/domain/note";

/**
 * Wire shape for a single note. Mirrors the JSON contract documented
 * in requirements.md (id, publicId, content, status, timestamps) plus
 * the v0.4/v0.5 additions (linkedNoteIds, tags), the v0.7 capture-time
 * addition (whyItMatters), and the v0.7 review-lifecycle additions
 * (processedAt, lastReviewedAt, nextReviewAt, reviewCount).
 */
export interface NoteDto {
  id: string;
  publicId: string;
  content: string;
  whyItMatters: string | null;
  status: Note["status"];
  linkedNoteIds: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  reviewCount: number;
}

function toIso(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

export function noteDto(note: Note): NoteDto {
  return {
    id: note.id,
    publicId: note.publicId,
    content: note.content,
    whyItMatters: note.whyItMatters,
    status: note.status,
    linkedNoteIds: [...note.linkedNoteIds],
    tags: [...note.tags],
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    processedAt: toIso(note.processedAt),
    lastReviewedAt: toIso(note.lastReviewedAt),
    nextReviewAt: toIso(note.nextReviewAt),
    reviewCount: note.reviewCount,
  };
}
