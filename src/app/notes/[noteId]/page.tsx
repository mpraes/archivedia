import { notFound } from "next/navigation";
import { getNoteServiceDeps } from "@/services/dependencies";
import { getNote } from "@/services/get-note.service";
import { noteDto } from "@/lib/note-dto";
import { NoteEditor } from "@/components/NoteEditor";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ noteId: string }>;
}

export default async function NotePage({ params }: PageProps) {
  const { noteId } = await params;
  try {
    const note = await getNote(getNoteServiceDeps(), noteId);
    return <NoteEditor initialNote={noteDto(note)} />;
  } catch {
    notFound();
  }
}
