import type { Note } from "@/domain/note";

/**
 * Wire shape for a single note. Mirrors the JSON contract documented
 * in requirements.md (id, publicId, content, status, timestamps).
 */
export interface NoteDto {
  id: string;
  publicId: string;
  content: string;
  status: "inbox";
  createdAt: string;
  updatedAt: string;
}

export function noteDto(note: Note): NoteDto {
  return {
    id: note.id,
    publicId: note.publicId,
    content: note.content,
    status: note.status,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}
