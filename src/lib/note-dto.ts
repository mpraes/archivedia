import type { Note } from "@/domain/note";

/**
 * Wire shape for a single note. Mirrors the JSON contract documented
 * in requirements.md (id, publicId, content, status, timestamps) plus
 * the v0.4/v0.5 additions: linkedNoteIds (parsed `[[publicId]]` refs)
 * and tags (free-form labels).
 */
export interface NoteDto {
  id: string;
  publicId: string;
  content: string;
  status: Note["status"];
  linkedNoteIds: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export function noteDto(note: Note): NoteDto {
  return {
    id: note.id,
    publicId: note.publicId,
    content: note.content,
    status: note.status,
    linkedNoteIds: [...note.linkedNoteIds],
    tags: [...note.tags],
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}
