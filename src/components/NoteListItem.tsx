"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { NoteDto } from "@/lib/note-dto";
import type { NoteStatus } from "@/domain/note-status";
import { formatLocalTime, preview } from "@/lib/format";
import { TagChip } from "./TagChip";

interface NoteListItemProps {
  note: NoteDto;
}

const RECENT_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export function NoteListItem({ note }: NoteListItemProps) {
  const locale = useLocale();
  const t = useTranslations("filters");
  const isRecent = isRecentlyProcessed(note);

  return (
    <li>
      <Link
        href={`/notes/${encodeURIComponent(note.id)}`}
        className={`block rounded-lg border border-transparent px-4 py-3 motion-safe:transition-colors motion-safe:duration-200 motion-safe:ease-out hover:border-[var(--color-line)] ${
          note.status === "permanent"
            ? "bg-surface-soft hover:bg-surface"
            : "hover:bg-surface-soft"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-1 text-xs uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
          <time dateTime={note.createdAt}>{formatLocalTime(note.createdAt, locale)}</time>
          <div className="flex flex-wrap items-center gap-1.5">
            {isRecent ? (
              <span
                title={t("recent")}
                aria-label={t("recent")}
                className="rounded-full bg-[var(--color-accent-soft)] px-1.5 py-0 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-accent)]"
              >
                {t("recent")}
              </span>
            ) : null}
            <StatusBadge status={note.status} label={statusLabel(t, note.status)} />
          </div>
        </div>
        <p className="mt-2 font-[var(--font-display)] text-base text-[var(--color-ink)]">
          {preview(note.content)}
        </p>
        {note.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {note.tags.slice(0, 3).map((tag) => (
              <TagChip key={tag} tag={tag} filterHref={`/?tag=${encodeURIComponent(tag)}`} />
            ))}
            {note.tags.length > 3 ? (
              <span className="text-[10px] tracking-[0.18em] text-[var(--color-ink-soft)]">
                +{note.tags.length - 3}
              </span>
            ) : null}
          </div>
        ) : null}
      </Link>
    </li>
  );
}

function statusLabel(
  t: (key: string) => string,
  status: NoteStatus,
): string {
  switch (status) {
    case "permanent":
      return t("permanent");
    case "inbox":
      return status;
  }
}

function StatusBadge({ status, label }: { status: NoteStatus; label: string }) {
  const tone =
    status === "permanent"
      ? "border border-[var(--color-line)] bg-[var(--color-paper)] text-[var(--color-ink-soft)]"
      : "bg-[var(--color-accent-soft)] text-[var(--color-accent)]";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] tracking-[0.18em] ${tone}`}
    >
      {label}
    </span>
  );
}

function isRecentlyProcessed(note: NoteDto, now: number = Date.now()): boolean {
  // "Recent" = the note is permanent AND was last touched within the
  // last 24h. This catches the freshly-processed case (status flip
  // bumps updatedAt) and the recently-edited-permanent case.
  if (note.status !== "permanent") return false;
  const updatedMs = new Date(note.updatedAt).getTime();
  return now - updatedMs < RECENT_THRESHOLD_MS;
}
