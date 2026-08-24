"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { NoteDto } from "@/lib/note-dto";
import type { NoteStatus } from "@/domain/note-status";
import { formatLocalTime, preview } from "@/lib/format";

interface NoteListItemProps {
  note: NoteDto;
}

export function NoteListItem({ note }: NoteListItemProps) {
  const locale = useLocale();
  const t = useTranslations("note");
  return (
    <li>
      <Link
        href={`/notes/${encodeURIComponent(note.id)}`}
        className={`block rounded-lg border border-transparent px-4 py-3 motion-safe:transition-colors motion-safe:duration-200 motion-safe:ease-out hover:border-[var(--color-line)] hover:bg-white ${
          note.status === "permanent" ? "bg-white/40" : ""
        }`}
      >
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
          <time dateTime={note.createdAt}>{formatLocalTime(note.createdAt, locale)}</time>
          <StatusBadge status={note.status} label={statusLabel(t, note.status)} />
        </div>
        <p className="mt-2 font-[var(--font-display)] text-base text-[var(--color-ink)]">
          {preview(note.content)}
        </p>
      </Link>
    </li>
  );
}

function statusLabel(
  t: (key: string) => string,
  status: NoteStatus,
): string {
  // Inbox is the only state v0.1 ever rendered; permanent arrives with v0.2.
  // Keeping a switch makes the next status a deliberate choice, not a typo.
  switch (status) {
    case "permanent":
      return t("status_permanent");
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
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] tracking-[0.18em] motion-safe:transition-colors motion-safe:duration-200 motion-safe:ease-out ${tone}`}
    >
      {status === "permanent" ? (
        <span
          className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70"
          aria-hidden="true"
        />
      ) : null}
      {label}
    </span>
  );
}
