import type { NoteDto } from "@/lib/note-dto";
import { NoteListItem } from "./NoteListItem";

interface NoteListProps {
  notes: NoteDto[];
}

export function NoteList({ notes }: NoteListProps) {
  return (
    <ol className="divide-y divide-[var(--color-line)]/60">
      {notes.map((note) => (
        <NoteListItem key={note.id} note={note} />
      ))}
    </ol>
  );
}
