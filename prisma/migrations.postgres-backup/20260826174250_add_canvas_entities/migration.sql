-- v0.7 / Phase 3 (requirements_v2): introduce the Canvas. Each Space
-- owns exactly one Canvas in the MVP (the unique index on space_id
-- enforces that constraint at the DB layer), and each Canvas owns
-- CanvasNodes (note-cards or free-text cards) and CanvasEdges
-- (visual connections between them).
--
-- The design mirrors the JSON Canvas spec
-- (https://jsoncanvas.org/spec/1.0/) so an export path is easy later:
-- nodes carry position + size, edges connect two nodes by id and may
-- carry an optional label and side handles.
--
-- Notes:
-- - viewport is JSONB so we can evolve the React Flow pan/zoom state
--   without migrations.
-- - CanvasNode has either noteId OR text set (validated in the
--   service layer — DB-level CHECK constraints are awkward across
--   Postgres + the in-memory test fake).
-- - Deleting a Canvas cascades to all nodes/edges; deleting a Note
--   sets CanvasNode.note_id to NULL (the card stays as a placeholder
--   rather than vanishing from the user's layout).
-- - Edges reference both endpoints with cascade so dangling edges
--   can't accumulate when the user re-arranges a Space.
CREATE TYPE "CanvasNodeType" AS ENUM ('note', 'text');

CREATE TYPE "CanvasHandle" AS ENUM ('top', 'right', 'bottom', 'left');

CREATE TABLE "canvases" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "space_id"   UUID         NOT NULL,
  "name"       VARCHAR(120) NOT NULL DEFAULT 'Main canvas',
  "viewport"   JSONB        NOT NULL DEFAULT '{"x":0,"y":0,"zoom":1}',
  "created_at" TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "canvases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "canvases_space_id_fkey" FOREIGN KEY ("space_id")
    REFERENCES "spaces"("id") ON DELETE CASCADE,
  CONSTRAINT "canvases_space_id_unique" UNIQUE ("space_id")
);

CREATE TABLE "canvas_nodes" (
  "id"         UUID             NOT NULL DEFAULT gen_random_uuid(),
  "canvas_id"  UUID             NOT NULL,
  "type"       "CanvasNodeType" NOT NULL,
  "note_id"    UUID,
  "text"       TEXT,
  "x"          INTEGER          NOT NULL DEFAULT 0,
  "y"          INTEGER          NOT NULL DEFAULT 0,
  "width"      INTEGER          NOT NULL DEFAULT 320,
  "height"     INTEGER          NOT NULL DEFAULT 180,
  "z_index"    INTEGER          NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "canvas_nodes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "canvas_nodes_canvas_id_fkey" FOREIGN KEY ("canvas_id")
    REFERENCES "canvases"("id") ON DELETE CASCADE,
  CONSTRAINT "canvas_nodes_note_id_fkey" FOREIGN KEY ("note_id")
    REFERENCES "notes"("id") ON DELETE SET NULL
);

CREATE INDEX "idx_canvas_nodes_canvas" ON "canvas_nodes" ("canvas_id");

CREATE TABLE "canvas_edges" (
  "id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
  "canvas_id"      UUID          NOT NULL,
  "source_node_id" UUID          NOT NULL,
  "target_node_id" UUID          NOT NULL,
  "label"          VARCHAR(64),
  "source_handle"  "CanvasHandle",
  "target_handle"  "CanvasHandle",
  "created_at"     TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "canvas_edges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "canvas_edges_canvas_id_fkey" FOREIGN KEY ("canvas_id")
    REFERENCES "canvases"("id") ON DELETE CASCADE,
  CONSTRAINT "canvas_edges_source_node_id_fkey" FOREIGN KEY ("source_node_id")
    REFERENCES "canvas_nodes"("id") ON DELETE CASCADE,
  CONSTRAINT "canvas_edges_target_node_id_fkey" FOREIGN KEY ("target_node_id")
    REFERENCES "canvas_nodes"("id") ON DELETE CASCADE,
  CONSTRAINT "canvas_edges_endpoints_distinct"
    CHECK ("source_node_id" <> "target_node_id")
);

CREATE INDEX "idx_canvas_edges_canvas" ON "canvas_edges" ("canvas_id");
