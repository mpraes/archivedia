"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ApiError, api } from "@/lib/api";
import { translateErrorSync } from "@/lib/errors-i18n";
import type { NoteDto } from "@/lib/note-dto";
import { preview } from "@/lib/format";

interface BacklinksPanelProps {
  noteId: string;
}

/**
 * Lists notes that reference the target via `[[publicId]]` syntax. Fetches
 * lazily on mount; shows a quiet empty state when the target has no
 * inbound links yet (which is the common case for fresh notes).
 */
export function BacklinksPanel({ noteId }: BacklinksPanelProps) {
  const t = useTranslations("note");
  const tErrors = useTranslations("errors");
  const [items, setItems] = useState<NoteDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getBacklinks(noteId)
      .then(({ data }) => {
        if (!cancelled) setItems(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError ? translateErrorSync(err, tErrors) : t("backlinks_empty");
        setError(message);
      });
    return () => {
      cancelled = true;
    };
  }, [noteId, tErrors]);

  return (
    <section
      aria-labelledby="backlinks-title"
      className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface-soft p-5 sm:p-6"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h3
          id="backlinks-title"
          className="font-[var(--font-display)] text-base text-[var(--color-ink)]"
        >
          {t("backlinks_title")}
        </h3>
        {items ? (
          <span className="rounded-full bg-[var(--color-accent-soft)]/50 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
            {t("backlinks_count", { count: items.length })}
          </span>
        ) : null}
      </header>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-[var(--color-warn)]">
          {error}
        </p>
      ) : items === null ? (
        <ul className="mt-4 space-y-2" aria-hidden="true">
          <SkeletonRow />
          <SkeletonRow />
        </ul>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">{t("backlinks_empty")}</p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--color-line)]/60">
          {items.map((note) => (
            <li key={note.id}>
              <Link
                href={`/notes/${encodeURIComponent(note.id)}`}
                className="block rounded-lg border border-transparent px-3 py-2 motion-safe:transition-colors motion-safe:duration-200 motion-safe:ease-out hover:border-[var(--color-line)] hover:bg-surface"
              >
                <p className="font-[var(--font-display)] text-sm text-[var(--color-ink)]">
                  {preview(note.content, 120)}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
                  {note.publicId}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SkeletonRow() {
  return (
    <li className="space-y-2 rounded-lg px-3 py-2">
      <div className="h-4 w-3/4 rounded bg-[var(--color-line)]/40" />
      <div className="h-3 w-16 rounded bg-[var(--color-line)]/30" />
    </li>
  );
}
