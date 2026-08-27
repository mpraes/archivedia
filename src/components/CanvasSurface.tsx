"use client";

import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  type Edge,
  type Node,
  type NodeChange,
  type NodeMouseHandler,
  type NodeProps,
  type NodeTypes,
  type OnConnect,
  type OnNodesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import { ApiError, api, type CanvasEdgeDto, type CanvasNodeDto } from "@/lib/api";
import { displayPreview } from "@/lib/format";
import type { NoteDto } from "@/lib/note-dto";

interface CanvasSurfaceProps {
  spaceId: string;
  canvas: {
    id: string;
    spaceId: string;
    name: string;
    viewport: { x: number; y: number; zoom: number };
    createdAt: string;
    updatedAt: string;
  };
  initialNodes: CanvasNodeDto[];
  initialEdges: CanvasEdgeDto[];
}

type NoteNode = Node<NoteNodeData, "note">;
type TextNode = Node<TextNodeData, "text">;
type NoteNodeData = { dto: CanvasNodeDto; note?: NoteDto };
type TextNodeData = { dto: CanvasNodeDto };
type RFNode = NoteNode | TextNode;

function toFlowNode(node: CanvasNodeDto, note?: NoteDto): RFNode {
  const base = {
    id: node.id,
    position: { x: node.x, y: node.y },
    width: node.width,
    height: node.height,
    zIndex: node.zIndex,
    dragHandle: ".drag-handle",
  };
  return node.type === "note"
    ? { ...base, type: "note", data: { dto: node, note } }
    : { ...base, type: "text", data: { dto: node } };
}

function toFlowEdge(edge: CanvasEdgeDto): Edge {
  return {
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    label: edge.label ?? undefined,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
  };
}

interface CanvasActions {
  spaceId: string;
  removeNode: (nodeId: string) => void;
  bringToFront: (nodeId: string) => void;
  editTextNode: (nodeId: string, text: string) => void;
}

const CanvasActionsContext = createContext<CanvasActions | null>(null);

function useCanvasActions(): CanvasActions {
  const ctx = useContext(CanvasActionsContext);
  if (!ctx) throw new Error("CanvasActionsContext used outside CanvasSurface");
  return ctx;
}

export function CanvasSurface(props: CanvasSurfaceProps) {
  return (
    <ReactFlowProvider>
      <CanvasSurfaceInner {...props} />
    </ReactFlowProvider>
  );
}

const nodeTypes: NodeTypes = {
  note: NoteCardNode,
  text: TextCardNode,
};

function CanvasSurfaceInner({
  spaceId,
  canvas,
  initialNodes,
  initialEdges,
}: CanvasSurfaceProps) {
  const t = useTranslations("spaces.canvas");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const [nodes, setNodes] = useState<RFNode[]>(() => initialNodes.map((n) => toFlowNode(n)));
  const [edges, setEdges] = useState<Edge[]>(() => initialEdges.map(toFlowEdge));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingViewport = useRef<{ x: number; y: number; zoom: number } | null>(null);
  const [noteMap, setNoteMap] = useState<Map<string, NoteDto>>(new Map());
  const [candidates, setCandidates] = useState<NoteDto[]>([]);
  const [activePanel, setActivePanel] = useState<"note" | "text" | null>(null);

  useEffect(() => {
    const noteIds = initialNodes
      .filter((n) => n.type === "note" && n.noteId)
      .map((n) => n.noteId!);
    if (noteIds.length === 0) return;
    void Promise.all(
      noteIds.map(async (id) => {
        try {
          const { data } = await api.getNote(id);
          return [id, data] as const;
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      const map = new Map<string, NoteDto>();
      for (const result of results) {
        if (result) map.set(result[0], result[1]);
      }
      setNoteMap(map);
    });
  }, [initialNodes]);

  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.type !== "note") return n;
        const noteId = n.data.dto.noteId;
        const note = noteId ? noteMap.get(noteId) : undefined;
        if (!note || n.data.note === note) return n;
        return { ...n, data: { ...n.data, note } };
      }),
    );
  }, [noteMap]);

  useEffect(() => {
    api
      .listNotes({ status: "permanent", limit: 500 })
      .then((res) => setCandidates(res.data))
      .catch(() => setCandidates([]));
  }, []);

  const onNodesChange: OnNodesChange<RFNode> = useCallback(
    (changes: NodeChange<RFNode>[]) => {
      setNodes((prev) => applyNodeChanges<RFNode>(changes, prev) as RFNode[]);
    },
    [],
  );

  const persistViewport = useCallback(async () => {
    if (!pendingViewport.current) return;
    const next = pendingViewport.current;
    pendingViewport.current = null;
    try {
      await api.patchCanvasViewport(spaceId, next);
    } catch {
      // Surface a soft error rather than throwing — pan/zoom is a UI hint,
      // not a critical write. Designers can decide whether to retry.
    }
  }, [spaceId]);

  const onConnect: OnConnect = useCallback(
    async (params) => {
      if (!params.source || !params.target) return;
      setBusy(true);
      setError(null);
      try {
        const sourceHandle = (params.sourceHandle ?? null) as
          | "top"
          | "right"
          | "bottom"
          | "left"
          | null;
        const targetHandle = (params.targetHandle ?? null) as
          | "top"
          | "right"
          | "bottom"
          | "left"
          | null;
        await api.addCanvasEdge(spaceId, {
          sourceNodeId: params.source,
          targetNodeId: params.target,
          sourceHandle: sourceHandle ?? undefined,
          targetHandle: targetHandle ?? undefined,
        });
        setEdges((prev) => [
          ...prev,
          {
            id: `tmp-${Date.now()}`,
            source: params.source,
            target: params.target,
            sourceHandle: sourceHandle ?? undefined,
            targetHandle: targetHandle ?? undefined,
          },
        ]);
      } catch (err) {
        const message =
          err instanceof ApiError ? translateErrorSync(err, tErrors) : t("errors.add_edge");
        setError(message);
      } finally {
        setBusy(false);
      }
    },
    [spaceId, t, tErrors],
  );

  const persistLayout = useCallback(
    async (nodeId: string, patch: { x?: number; y?: number; width?: number; height?: number }) => {
      try {
        await api.patchCanvasNode(spaceId, nodeId, patch);
      } catch (err) {
        const message =
          err instanceof ApiError ? translateErrorSync(err, tErrors) : t("errors.save_layout");
        setError(message);
      }
    },
    [spaceId, t, tErrors],
  );

  const onNodeDragStop = useCallback(
    (_event: unknown, node: RFNode) => {
      const prev = initialNodes.find((n) => n.id === node.id);
      if (!prev) return;
      if (prev.x === node.position.x && prev.y === node.position.y) return;
      void persistLayout(node.id, { x: node.position.x, y: node.position.y });
    },
    [initialNodes, persistLayout],
  );

  const onNodeClick: NodeMouseHandler<RFNode> = useCallback(() => {
    // Clicking a note card body is a no-op; the "Open note" affordance
    // is rendered inside the card. Future: open a side preview.
  }, []);

  const removeNode = useCallback(
    async (nodeId: string) => {
      setNodes((prev) => prev.filter((n) => n.id !== nodeId));
      setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
      try {
        await api.removeCanvasNode(spaceId, nodeId);
      } catch (err) {
        const message =
          err instanceof ApiError ? translateErrorSync(err, tErrors) : t("errors.remove");
        setError(message);
      }
    },
    [spaceId, t, tErrors],
  );

  const bringToFront = useCallback(
    async (nodeId: string) => {
      const maxZ = Math.max(0, ...nodes.map((n) => n.zIndex ?? 0));
      const nextZ = maxZ + 1;
      setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, zIndex: nextZ } : n)));
      try {
        await api.patchCanvasNode(spaceId, nodeId, { zIndex: nextZ });
      } catch (err) {
        const message =
          err instanceof ApiError ? translateErrorSync(err, tErrors) : t("errors.save_layout");
        setError(message);
      }
    },
    [nodes, spaceId, t, tErrors],
  );

  const editTextNode = useCallback(
    async (nodeId: string, text: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node || node.type !== "text") return;
      const trimmed = text.trim();
      if (!trimmed) return;
      setBusy(true);
      setError(null);
      try {
        await api.removeCanvasNode(spaceId, nodeId);
        const { data } = await api.addCanvasNode(spaceId, {
          type: "text",
          text: trimmed,
          x: node.position.x,
          y: node.position.y,
          width: node.width ?? 320,
          height: node.height ?? 160,
          zIndex: node.zIndex ?? 0,
        });
        setNodes((prev) => prev.filter((n) => n.id !== nodeId).concat(toFlowNode(data)));
        setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
      } catch (err) {
        const message =
          err instanceof ApiError ? translateErrorSync(err, tErrors) : t("errors.add_node");
        setError(message);
      } finally {
        setBusy(false);
      }
    },
    [nodes, spaceId, t, tErrors],
  );

  const addNoteCard = useCallback(
    async (noteId: string) => {
      if (!noteId) return;
      setBusy(true);
      setError(null);
      try {
        const { data } = await api.addCanvasNode(spaceId, {
          type: "note",
          noteId,
          x: 80 + Math.random() * 200,
          y: 80 + Math.random() * 200,
          width: 320,
          height: 180,
          zIndex: 0,
        });
        const note = candidates.find((n) => n.id === noteId);
        setNodes((prev) => [...prev, toFlowNode(data, note)]);
        setActivePanel(null);
      } catch (err) {
        const message =
          err instanceof ApiError ? translateErrorSync(err, tErrors) : t("errors.add_node");
        setError(message);
      } finally {
        setBusy(false);
      }
    },
    [spaceId, t, tErrors, candidates],
  );

  const addTextCard = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setBusy(true);
      setError(null);
      try {
        const { data } = await api.addCanvasNode(spaceId, {
          type: "text",
          text: trimmed,
          x: 120 + Math.random() * 200,
          y: 120 + Math.random() * 200,
          width: 320,
          height: 160,
          zIndex: 0,
        });
        setNodes((prev) => [...prev, toFlowNode(data)]);
        setActivePanel(null);
      } catch (err) {
        const message =
          err instanceof ApiError ? translateErrorSync(err, tErrors) : t("errors.add_node");
        setError(message);
      } finally {
        setBusy(false);
      }
    },
    [spaceId, t, tErrors],
  );

  const isEmpty = useMemo(() => nodes.length === 0, [nodes.length]);

  const existingNoteIds = useMemo(
    () =>
      new Set(
        nodes
          .filter((n) => n.type === "note")
          .map((n) => n.data.dto.noteId)
          .filter((id): id is string => Boolean(id)),
      ),
    [nodes],
  );

  const canvasActions = useMemo<CanvasActions>(
    () => ({ spaceId, removeNode, bringToFront, editTextNode }),
    [spaceId, removeNode, bringToFront, editTextNode],
  );

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface">
      <header className="relative flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)]/60 px-5 py-4">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
          {canvas.name}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setActivePanel((p) => (p === "note" ? null : "note"))}
              disabled={busy}
              className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] transition-all duration-200 hover:border-[var(--color-accent)] disabled:opacity-60"
            >
              {t("add_note_button")}
            </button>
            {activePanel === "note" ? (
              <AddNotePanel
                candidates={candidates}
                existingNoteIds={existingNoteIds}
                onSelect={addNoteCard}
                onClose={() => setActivePanel(null)}
              />
            ) : null}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setActivePanel((p) => (p === "text" ? null : "text"))}
              disabled={busy}
              className="rounded-full bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all duration-200 hover:bg-[var(--color-accent)]/90 hover:shadow-md disabled:opacity-60"
            >
              {t("add_text_button")}
            </button>
            {activePanel === "text" ? (
              <AddTextPanel onSubmit={addTextCard} onClose={() => setActivePanel(null)} />
            ) : null}
          </div>
        </div>
      </header>

      {error ? (
        <p role="alert" className="px-5 text-sm text-[var(--color-warn)]">
          {error}
        </p>
      ) : null}

      <div className="relative h-[60vh] min-h-[480px] overflow-hidden rounded-b-[var(--radius-card)]">
        {isEmpty ? (
          <EmptyCanvas onAddNote={() => setActivePanel("note")} onAddText={() => setActivePanel("text")} />
        ) : (
          <CanvasActionsContext.Provider value={canvasActions}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onConnect={onConnect}
              onNodeDragStop={onNodeDragStop}
              onNodeClick={onNodeClick}
              onMoveEnd={(_event, viewport) => {
                pendingViewport.current = viewport;
                void persistViewport();
              }}
              defaultViewport={canvas.viewport}
              fitView
              proOptions={{ hideAttribution: true }}
              nodeTypes={nodeTypes}
            >
              <Background gap={24} size={1} />
              <Controls />
            </ReactFlow>
          </CanvasActionsContext.Provider>
        )}
      </div>

      <CanvasStyles />
    </section>
  );
}

function EmptyCanvas({
  onAddNote,
  onAddText,
}: {
  onAddNote: () => void;
  onAddText: () => void;
}) {
  const t = useTranslations("spaces.canvas");
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-[var(--color-paper)]/40 px-6 text-center">
      <div className="relative" aria-hidden="true">
        <div className="h-16 w-24 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface shadow-[0_12px_30px_-20px_rgba(0,0,0,0.15)]" />
        <div className="absolute -bottom-3 -right-4 h-14 w-20 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface shadow-[0_12px_30px_-20px_rgba(0,0,0,0.15)]" />
      </div>
      <div>
        <p className="font-[var(--font-display)] text-xl text-[var(--color-ink)]">{t("empty_title")}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-[var(--color-ink-soft)]">
          {t("empty_description")}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onAddNote}
          className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] transition-all duration-200 hover:border-[var(--color-accent)]"
        >
          {t("add_note_button")}
        </button>
        <button
          type="button"
          onClick={onAddText}
          className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[var(--color-accent)]/90 hover:shadow-md"
        >
          {t("add_text_button")}
        </button>
      </div>
    </div>
  );
}

function usePanelDismiss(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as HTMLElement)) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClick);
    };
  }, [ref, onClose]);
}

function AddNotePanel({
  candidates,
  existingNoteIds,
  onSelect,
  onClose,
}: {
  candidates: NoteDto[];
  existingNoteIds: Set<string>;
  onSelect: (noteId: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("spaces.canvas");
  const tCommon = useTranslations("common");
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  usePanelDismiss(panelRef, onClose);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates
      .filter((n) => !existingNoteIds.has(n.id))
      .filter((n) => !q || n.content.toLowerCase().includes(q));
  }, [candidates, existingNoteIds, query]);

  return (
    <div ref={panelRef} className="absolute right-0 top-full z-50 mt-2 w-80 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-4 shadow-[0_12px_40px_-20px_rgba(0,0,0,0.2)]">
      <div className="flex items-center justify-between gap-2">
        <p className="font-[var(--font-display)] text-base text-[var(--color-ink)]">{t("add_note_title")}</p>
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-ink)]"
          aria-label={tCommon("cancel")}
        >
          ×
        </button>
      </div>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("search_notes_placeholder")}
        className="mt-3 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)]/60 px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-soft)]/50 focus:border-[var(--color-accent)] focus:outline-none"
      />
      <div className="mt-2 max-h-60 overflow-auto">
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--color-ink-soft)]">{t("no_notes_found")}</p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => onSelect(note.id)}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--color-ink)] transition-colors hover:bg-[var(--color-paper)]/70"
                >
                  <span className="line-clamp-2 font-[var(--font-display)]">{displayPreview(note.content, 120)}</span>
                  <span className="mt-1 block text-xs text-[var(--color-ink-soft)]">
                    {t(`card_status_${note.status}`)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AddTextPanel({
  onSubmit,
  onClose,
}: {
  onSubmit: (text: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("spaces.canvas");
  const tCommon = useTranslations("common");
  const [text, setText] = useState("");
  const panelRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  usePanelDismiss(panelRef, onClose);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(text);
    },
    [onSubmit, text],
  );

  return (
    <form
      ref={panelRef}
      onSubmit={handleSubmit}
      className="absolute right-0 top-full z-50 mt-2 w-80 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-4 shadow-[0_12px_40px_-20px_rgba(0,0,0,0.2)]"
    >
      <p className="font-[var(--font-display)] text-base text-[var(--color-ink)]">{t("add_text_title")}</p>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("text_card_placeholder")}
        rows={4}
        className="mt-3 w-full resize-y rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)]/60 px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-soft)]/50 focus:border-[var(--color-accent)] focus:outline-none"
      />
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-accent)]"
        >
          {tCommon("cancel")}
        </button>
        <button
          type="submit"
          disabled={!text.trim()}
          className="rounded-full bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:bg-[var(--color-accent)]/90 disabled:opacity-60"
        >
          {tCommon("save")}
        </button>
      </div>
    </form>
  );
}

function NoteCardNode(props: NodeProps<NoteNode>) {
  const t = useTranslations("spaces.canvas");
  const { data, selected } = props;
  const { dto, note } = data;
  const status = note?.status ?? "permanent";
  const preview = note ? displayPreview(note.content, 160) : dto.noteId ?? t("open_note");

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-[12px] border bg-surface shadow-[0_1px_0_rgba(0,0,0,0.02),0_12px_30px_-20px_rgba(0,0,0,0.15)] transition-shadow duration-200 ${
        selected ? "border-[var(--color-accent)]" : "border-[var(--color-line)]"
      }`}
    >
      <NodeHandles selected={selected} />
      <div className="drag-handle flex cursor-grab items-center justify-between gap-2 border-b border-[var(--color-line)]/60 bg-[var(--color-paper)]/40 px-3 py-2 active:cursor-grabbing">
        <StatusPill status={status} />
        <CardMenu nodeId={dto.id} />
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-4 font-[var(--font-display)] text-sm leading-relaxed text-[var(--color-ink)]">
          {preview}
        </p>
        {note ? (
          <Link
            href={`/notes/${encodeURIComponent(note.id)}`}
            className="nodrag mt-auto inline-flex pt-3 text-xs font-medium text-[var(--color-accent)] underline-offset-4 transition-opacity hover:opacity-80"
          >
            {t("open_note")}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function TextCardNode(props: NodeProps<TextNode>) {
  const t = useTranslations("spaces.canvas");
  const { data, selected } = props;
  const { dto } = data;
  const [editing, setEditing] = useState(false);
  const { editTextNode } = useCanvasActions();

  if (editing) {
    return (
      <TextCardEditor
        initialText={dto.text ?? ""}
        onSave={(text) => {
          void editTextNode(dto.id, text);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-[12px] border bg-surface shadow-[0_1px_0_rgba(0,0,0,0.02),0_12px_30px_-20px_rgba(0,0,0,0.15)] transition-shadow duration-200 ${
        selected ? "border-[var(--color-accent)]" : "border-[var(--color-line)]"
      }`}
    >
      <NodeHandles selected={selected} />
      <div className="drag-handle flex cursor-grab items-center justify-end gap-2 border-b border-[var(--color-line)]/60 bg-[var(--color-paper)]/40 px-3 py-2 active:cursor-grabbing">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          className="nodrag rounded-md p-1 text-[var(--color-ink-soft)] opacity-0 transition-all duration-200 hover:bg-[var(--color-paper)]/70 hover:text-[var(--color-ink)] group-hover:opacity-100 focus:opacity-100"
          aria-label={t("edit")}
        >
          ✎
        </button>
        <CardMenu nodeId={dto.id} />
      </div>
      <div className="flex flex-1 items-center p-4">
        <p className="font-[var(--font-display)] text-lg leading-snug text-[var(--color-ink)]">
          {dto.text}
        </p>
      </div>
    </article>
  );
}

function TextCardEditor({
  initialText,
  onSave,
  onCancel,
}: {
  initialText: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const tCommon = useTranslations("common");
  const [text, setText] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(text);
      }}
      className="flex h-full flex-col overflow-hidden rounded-[12px] border border-[var(--color-accent)] bg-surface shadow-[0_12px_30px_-20px_rgba(0,0,0,0.2)]"
      onClick={(e) => e.stopPropagation()}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="nodrag flex-1 resize-none bg-transparent p-4 font-[var(--font-display)] text-lg leading-snug text-[var(--color-ink)] placeholder:text-[var(--color-ink-soft)]/50 focus:outline-none"
      />
      <div className="flex items-center justify-end gap-2 border-t border-[var(--color-line)]/60 p-2">
        <button
          type="button"
          onClick={onCancel}
          className="nodrag rounded-full border border-[var(--color-line)] px-3 py-1 text-xs font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-accent)]"
        >
          {tCommon("cancel")}
        </button>
        <button
          type="submit"
          disabled={!text.trim()}
          className="nodrag rounded-full bg-[var(--color-accent)] px-3 py-1 text-xs font-medium text-white shadow-sm transition-all hover:bg-[var(--color-accent)]/90 disabled:opacity-60"
        >
          {tCommon("save")}
        </button>
      </div>
    </form>
  );
}

function NodeHandles({ selected }: { selected: boolean }) {
  const base =
    "!h-2.5 !w-2.5 !rounded-full !border-0 !bg-[var(--color-accent)] opacity-0 transition-opacity duration-200";
  const visible = selected ? "!opacity-100" : "group-hover:!opacity-100";
  return (
    <>
      <Handle type="target" position={Position.Top} className={`${base} ${visible}`} />
      <Handle type="source" position={Position.Top} className={`${base} ${visible}`} />
      <Handle type="target" position={Position.Right} className={`${base} ${visible}`} />
      <Handle type="source" position={Position.Right} className={`${base} ${visible}`} />
      <Handle type="target" position={Position.Bottom} className={`${base} ${visible}`} />
      <Handle type="source" position={Position.Bottom} className={`${base} ${visible}`} />
      <Handle type="target" position={Position.Left} className={`${base} ${visible}`} />
      <Handle type="source" position={Position.Left} className={`${base} ${visible}`} />
    </>
  );
}

function StatusPill({ status }: { status: "permanent" | "inbox" | "deleted" }) {
  const t = useTranslations("spaces.canvas");
  return (
    <span className="rounded-full bg-[var(--color-paper)]/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-soft)]">
      {t(`card_status_${status}`)}
    </span>
  );
}

function CardMenu({ nodeId }: { nodeId: string }) {
  const t = useTranslations("spaces.canvas");
  const { removeNode, bringToFront } = useCanvasActions();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as HTMLElement)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="nodrag rounded-md p-1 text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-paper)]/70 hover:text-[var(--color-ink)]"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("open_note")}
      >
        ⋯
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-44 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface py-1 shadow-[0_12px_40px_-20px_rgba(0,0,0,0.2)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              void bringToFront(nodeId);
              setOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-xs text-[var(--color-ink)] transition-colors hover:bg-[var(--color-paper)]/70"
          >
            {t("bring_to_front")}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              void removeNode(nodeId);
              setOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-xs text-[var(--color-warn)] transition-colors hover:bg-[var(--color-warn)]/[0.06]"
          >
            {t("remove_from_canvas")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Translates an ApiError into a user-facing message using the shared
 * error message table. Imported locally to keep the surface
 * dependency-free for the React Flow bundle.
 */
function translateErrorSync(err: ApiError, t: (key: string) => string): string {
  const code = err.code;
  if (code === "VALIDATION_ERROR") return t("VALIDATION_ERROR");
  if (code === "NOTE_NOT_FOUND") return t("NOTE_NOT_FOUND");
  if (code === "INTERNAL_ERROR") return t("INTERNAL_ERROR");
  return t("DATABASE_UNAVAILABLE");
}

function CanvasStyles() {
  return (
    <style jsx global>{`
      .react-flow__node-note,
      .react-flow__node-text {
        border: none !important;
        background: transparent !important;
        padding: 0 !important;
      }
      .react-flow__node-note.selected,
      .react-flow__node-text.selected {
        outline: none !important;
        box-shadow: none !important;
      }
      .react-flow__handle {
        opacity: 0;
      }
      .react-flow__edge-path {
        stroke: var(--color-ink-soft);
        stroke-opacity: 0.45;
        stroke-width: 1.5;
      }
      .react-flow__edge.selected .react-flow__edge-path {
        stroke: var(--color-accent);
        stroke-opacity: 0.8;
      }
      .react-flow__edge-text {
        fill: var(--color-ink-soft);
        font-size: 11px;
      }
      .react-flow__controls {
        background: var(--color-paper);
        border: 1px solid var(--color-line);
        border-radius: var(--radius-card);
        box-shadow: 0 12px 30px -20px rgba(0, 0, 0, 0.15);
      }
      .react-flow__controls-button {
        background: transparent;
        border-bottom: 1px solid var(--color-line);
        color: var(--color-ink);
      }
      .react-flow__controls-button:hover {
        background: var(--color-accent-soft);
      }
      .react-flow__controls-button:last-child {
        border-bottom: none;
      }
      .react-flow__controls-button svg {
        fill: currentColor;
      }
      .react-flow__background {
        color: var(--color-line);
      }
      @media (prefers-reduced-motion: reduce) {
        .react-flow__node-note,
        .react-flow__node-text,
        .react-flow__handle,
        .react-flow__edge-path {
          transition: none !important;
        }
      }
    `}</style>
  );
}
