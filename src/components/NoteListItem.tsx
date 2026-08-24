"use client";

import Link from "next/link";
import type { NoteDto } from "@/lib/note-dto";
import { formatLocalTime, preview } from "@/lib/format";
import { useLocale } from "next-intl";

interface NoteListItemProps {
  note: NoteDto;
}

export function NoteListItem({ note }: NoteListItemProps) {
  const locale = useLocale();
  return (
    <li>
      <Link
        href={`/notes/${encodeURIComponent(note.id)}`}
        className="block rounded-lg border border-transparent px-4 py-3 transition hover:border-[var(--color-line)] hover:bg-white"
      >
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">
          <time dateTime={note.createdAt}>{formatLocalTime(note.createdAt, locale)}</time>
          <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-[10px] tracking-[0.18em] text-[var(--color-accent)]">
            {note.status}
          </span>
        </div>
        <p className="mt-2 font-[var(--font-display)] text-base text-[var(--color-ink)]">
          {preview(note.content)}
        </p>
      </Link>
    </li>
  );
}
