import { listSpaces } from "@/services/spaces.service";
import { getNoteServiceDeps } from "@/services/dependencies";
import type { SpaceDto } from "@/lib/api";
import { SpacesListScreen } from "@/components/SpacesListScreen";

export const dynamic = "force-dynamic";

/**
 * Step 2.4: Spaces index. Lists active/completed Spaces with note
 * counts and a "+ New space" form. Archived spaces are hidden by
 * default to keep the list focused; the SpacesListScreen component
 * exposes a toggle if the user wants to see them.
 */
export default async function SpacesPage() {
  const deps = getNoteServiceDeps();
  const spaces = await listSpaces(deps);
  // Convert domain Date objects into ISO strings before crossing the
  // server→client boundary so the client component matches its
  // `SpaceDto` wire shape.
  const dtos: SpaceDto[] = spaces.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    status: s.status,
    noteCount: s.noteCount,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));
  return <SpacesListScreen initialSpaces={dtos} />;
}
