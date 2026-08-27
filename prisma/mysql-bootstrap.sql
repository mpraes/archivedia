-- ============================================================
-- archivedia — MariaDB bootstrap
--
-- Consolidated final state of all 11 PostgreSQL migrations
-- (prisma/migrations/*) translated to MariaDB 11.x DDL.
--
-- This file ONLY creates tables. It does NOT replace
-- prisma/schema.prisma — the Prisma client is still
-- configured for postgresql and will refuse this target
-- until the schema itself is rewritten. Use this for the
-- DB-layer part of a PG→MariaDB migration; the
-- prisma/schema.prisma + migration files rewrite is
-- separate work.
--
-- Translation notes:
--   * gen_random_uuid()  -> DEFAULT (UUID())        (MariaDB UUID())
--   * UUID column type   -> CHAR(36)               (readable; PG native type
--                                                   has no direct MariaDB equivalent
--                                                   until 10.7, and CHAR(36) is
--                                                   simpler for app-side UUID gen)
--   * TEXT[] (String[])  -> JSON + JSON_ARRAY()    (MariaDB has no native arrays)
--   * JSONB              -> JSON
--   * TIMESTAMPTZ(6)     -> DATETIME(6)            (UTC by convention; no tz stored)
--   * ENUM types         -> MariaDB ENUM
--   * Partial indexes    -> dropped (MariaDB has none; the full index is
--                           sufficient for the active-only ordering query)
--   * GIN array indexes  -> dropped (Prisma app code does client-side filtering
--                           on these; revisit if query patterns change)
--   * pgcrypto extension -> not needed; UUID() built in
-- ============================================================

SET NAMES utf8mb4;

-- ------------------------------------------------------------
-- notes (consolidated from init + v03_v05 + add_why_it_matters
--        + add_deleted_status + widen_status_check + add_review_fields)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notes` (
  `id`               CHAR(36)                                   NOT NULL DEFAULT (UUID()),
  `public_id`        VARCHAR(64)                                NOT NULL,
  `content`          TEXT                                       NOT NULL,
  `why_it_matters`   TEXT                                       NULL,
  `status`           ENUM('inbox','permanent','deleted')         NOT NULL DEFAULT 'inbox',
  `linked_note_ids`  JSON                                       NOT NULL,
  `tags`             JSON                                       NOT NULL,
  `created_at`       DATETIME(6)                                NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at`       DATETIME(6)                                NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `processed_at`     DATETIME(6)                                NULL,
  `last_reviewed_at` DATETIME(6)                                NULL,
  `next_review_at`   DATETIME(6)                                NULL,
  `review_count`     INT                                        NOT NULL DEFAULT 0,
  `deleted_at`       DATETIME(6)                                NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_notes_public_id`   (`public_id`),
  KEY        `idx_notes_created_at`   (`created_at` DESC),
  KEY        `idx_notes_review_queue` (`status`, `next_review_at`),
  CONSTRAINT `notes_content_not_blank` CHECK (CHAR_LENGTH(TRIM(`content`)) > 0),
  CONSTRAINT `notes_status_valid`      CHECK (`status` IN ('inbox','permanent','deleted'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- JSON columns can't take JSON_ARRAY() as inline DEFAULT on all MariaDB
-- versions; setting it via ALTER keeps it explicit and safe.
ALTER TABLE `notes`
  MODIFY COLUMN `linked_note_ids` JSON NOT NULL DEFAULT (JSON_ARRAY()),
  MODIFY COLUMN `tags`            JSON NOT NULL DEFAULT (JSON_ARRAY());

-- ------------------------------------------------------------
-- spaces (from add_space_entity)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `spaces` (
  `id`          CHAR(36)                                NOT NULL DEFAULT (UUID()),
  `title`       VARCHAR(200)                            NOT NULL,
  `description` TEXT                                    NULL,
  `status`      ENUM('active','completed','archived')   NOT NULL DEFAULT 'active',
  `created_at`  DATETIME(6)                             NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at`  DATETIME(6)                             NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_spaces_status_updated` (`status`, `updated_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- space_notes (from add_space_notes_join)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `space_notes` (
  `space_id` CHAR(36)                                    NOT NULL,
  `note_id`  CHAR(36)                                    NOT NULL,
  `added_at` DATETIME(6)                                 NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `added_by` ENUM('manual','review','created-in-space')  NOT NULL DEFAULT 'manual',
  PRIMARY KEY (`space_id`, `note_id`),
  KEY `idx_space_notes_note`        (`note_id`),
  KEY `idx_space_notes_space_added` (`space_id`, `added_at` DESC),
  CONSTRAINT `fk_space_notes_space` FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_space_notes_note`  FOREIGN KEY (`note_id`)  REFERENCES `notes`(`id`)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- canvases (from add_canvas_entities)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `canvases` (
  `id`         CHAR(36)      NOT NULL DEFAULT (UUID()),
  `space_id`   CHAR(36)      NOT NULL,
  `name`       VARCHAR(120)  NOT NULL DEFAULT 'Main canvas',
  `viewport`   JSON          NOT NULL DEFAULT (JSON_OBJECT('x', 0, 'y', 0, 'zoom', 1)),
  `created_at` DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_canvases_space_id` (`space_id`),
  CONSTRAINT `fk_canvases_space` FOREIGN KEY (`space_id`) REFERENCES `spaces`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- canvas_nodes (from add_canvas_entities)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `canvas_nodes` (
  `id`         CHAR(36)             NOT NULL DEFAULT (UUID()),
  `canvas_id`  CHAR(36)             NOT NULL,
  `type`       ENUM('note','text')  NOT NULL,
  `note_id`    CHAR(36)             NULL,
  `text`       TEXT                 NULL,
  `x`          INT                  NOT NULL DEFAULT 0,
  `y`          INT                  NOT NULL DEFAULT 0,
  `width`      INT                  NOT NULL DEFAULT 320,
  `height`     INT                  NOT NULL DEFAULT 180,
  `z_index`    INT                  NOT NULL DEFAULT 0,
  `created_at` DATETIME(6)          NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6)          NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_canvas_nodes_canvas` (`canvas_id`),
  KEY `idx_canvas_nodes_note`   (`note_id`),
  CONSTRAINT `fk_canvas_nodes_canvas` FOREIGN KEY (`canvas_id`) REFERENCES `canvases`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_canvas_nodes_note`   FOREIGN KEY (`note_id`)   REFERENCES `notes`(`id`)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- canvas_edges (from add_canvas_entities)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `canvas_edges` (
  `id`             CHAR(36)                                    NOT NULL DEFAULT (UUID()),
  `canvas_id`      CHAR(36)                                    NOT NULL,
  `source_node_id` CHAR(36)                                    NOT NULL,
  `target_node_id` CHAR(36)                                    NOT NULL,
  `label`          VARCHAR(64)                                 NULL,
  `source_handle`  ENUM('top','right','bottom','left')         NULL,
  `target_handle`  ENUM('top','right','bottom','left')         NULL,
  `created_at`     DATETIME(6)                                 NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at`     DATETIME(6)                                 NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `idx_canvas_edges_canvas` (`canvas_id`),
  CONSTRAINT `fk_canvas_edges_canvas` FOREIGN KEY (`canvas_id`)      REFERENCES `canvases`(`id`)      ON DELETE CASCADE,
  CONSTRAINT `fk_canvas_edges_source` FOREIGN KEY (`source_node_id`) REFERENCES `canvas_nodes`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_canvas_edges_target` FOREIGN KEY (`target_node_id`) REFERENCES `canvas_nodes`(`id`) ON DELETE CASCADE,
  CONSTRAINT `canvas_edges_endpoints_distinct` CHECK (`source_node_id` <> `target_node_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
