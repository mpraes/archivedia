-- Initial baseline for the MariaDB deployment of archivedia.
--
-- This is the consolidated DDL that matches prisma/schema.prisma after the
-- PostgreSQL -> MariaDB translation. The full rationale (with the diff
-- against each of the 11 original PG migrations) lives in
-- `prisma/mysql-bootstrap.sql` next to this file.
--
-- Target: MariaDB 10.2+ (the Hostinger MySQL plan ships MariaDB 11.8).
--
-- Conventions:
--   * UUID PKs      -> CHAR(36) DEFAULT (UUID())
--   * String arrays -> JSON NOT NULL DEFAULT (JSON_ARRAY())
--   * Timestamps    -> DATETIME(6), UTC by convention, with
--                      ON UPDATE CURRENT_TIMESTAMP(6) for updated_at
--   * Enums         -> MariaDB native ENUM
--   * Defence-in-depth CHECKs preserved from the PG version where
--                     Prisma can't express them (content not blank,
--                     status in valid set, edges have distinct endpoints).
--
-- IF NOT EXISTS makes this re-runnable against an already-bootstrapped DB.

-- ------------------------------------------------------------
-- notes
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

ALTER TABLE `notes`
  MODIFY COLUMN `linked_note_ids` JSON NOT NULL DEFAULT (JSON_ARRAY()),
  MODIFY COLUMN `tags`            JSON NOT NULL DEFAULT (JSON_ARRAY());

-- ------------------------------------------------------------
-- spaces
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
-- space_notes
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
-- canvases
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
-- canvas_nodes
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
-- canvas_edges
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
