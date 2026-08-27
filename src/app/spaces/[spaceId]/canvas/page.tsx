import { notFound } from "next/navigation";
import { getSpace } from "@/services/spaces.service";
import { getCanvasBundle } from "@/services/canvas.service";
import { getNoteServiceDeps } from "@/services/dependencies";
import { CanvasSurface } from "@/components/CanvasSurface";
import type { CanvasDto, CanvasEdgeDto, CanvasNodeDto } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Step 3.3: the Canvas tab for a Space. Server-rendered with the
 * current canvas bundle (canvas + nodes + edges) so the React Flow
 * tree mounts with the right viewport on first paint.
 */
export default async function CanvasPage({
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
  const bundle = await getCanvasBundle(deps, spaceId);
  const canvasDto: CanvasDto = {
    id: bundle.canvas.id,
    spaceId: bundle.canvas.spaceId,
    name: bundle.canvas.name,
    viewport: bundle.canvas.viewport,
    createdAt: bundle.canvas.createdAt.toISOString(),
    updatedAt: bundle.canvas.updatedAt.toISOString(),
  };
  const nodeDtos: CanvasNodeDto[] = bundle.nodes.map((n) => ({
    id: n.id,
    canvasId: n.canvasId,
    type: n.type,
    noteId: n.noteId,
    text: n.text,
    x: n.x,
    y: n.y,
    width: n.width,
    height: n.height,
    zIndex: n.zIndex,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  }));
  const edgeDtos: CanvasEdgeDto[] = bundle.edges.map((e) => ({
    id: e.id,
    canvasId: e.canvasId,
    sourceNodeId: e.sourceNodeId,
    targetNodeId: e.targetNodeId,
    label: e.label,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }));
  return (
    <CanvasSurface
      spaceId={spaceId}
      canvas={canvasDto}
      initialNodes={nodeDtos}
      initialEdges={edgeDtos}
    />
  );
}
