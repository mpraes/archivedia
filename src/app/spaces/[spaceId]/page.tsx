import { notFound } from "next/navigation";
import { getSpace, listNotesInSpace } from "@/services/spaces.service";
import { getNoteServiceDeps } from "@/services/dependencies";
import { noteDto } from "@/lib/note-dto";
import { SpaceDetailScreen } from "@/components/SpaceDetailScreen";

export const dynamic = "force-dynamic";

/**
 * Step 2.5: Space detail page. The first iteration ships the Notes
 * tab only; Canvas and Outline tabs are placeholders for Phase 3.
 */
export default async function SpaceDetailPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  const deps = getNoteServiceDeps();
  let space;
  try {
    space = await getSpace(deps, spaceId);
  } catch {
    notFound();
  }
  const notes = await listNotesInSpace(deps, { spaceId });
  return (
    <SpaceDetailScreen
      space={{
        id: space.id,
        title: space.title,
        description: space.description,
        status: space.status,
        noteCount: space.noteCount,
        createdAt: space.createdAt.toISOString(),
        updatedAt: space.updatedAt.toISOString(),
      }}
      notes={notes.map(noteDto)}
    />
  );
}
