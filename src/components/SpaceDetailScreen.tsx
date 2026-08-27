"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ApiError, api, type SpaceDto } from "@/lib/api";
import type { NoteDto } from "@/lib/note-dto";
import { translateErrorSync } from "@/lib/errors-i18n";
import { displayPreview } from "@/lib/format";

interface SpaceDetailScreenProps {
  space: SpaceDto;
  notes: NoteDto[];
}

type Tab = "notes" | "canvas" | "outline";

export function SpaceDetailScreen({ space, notes }: SpaceDetailScreenProps) {
  const router = useRouter();
  const t = useTranslations("spaces");
  const tTabs = useTranslations("spaces.detail.tabs");
  const tErrors = useTranslations("errors");
  const [tab, setTab] = useState<Tab>("notes");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<NoteDto[]>([]);
  const [newContent, setNewContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const permanentNotes = notes.filter((n) => n.status === "permanent");
  const inboxNotes = notes.filter((n) => n.status === "inbox");

  const searchExisting = async (event: React.FormEvent) => {
    event.preventDefault();
    if (search.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.listNotes({ q: search.trim(), limit: 20 });
      // Filter out notes already in this Space to avoid duplicate attach UX.
      const attached = new Set(notes.map((n) => n.id));
      setSearchResults(data.filter((n) => !attached.has(n.id)));
    } catch (err) {
      const message =
        err instanceof ApiError ? translateErrorSync(err, tErrors) : t("detail.errors.attach");
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const attach = async (noteId: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.attachNoteToSpace(space.id, { noteId });
      setSearchResults((prev) => prev.filter((n) => n.id !== noteId));
      router.refresh();
    } catch (err) {
      const message =
        err instanceof ApiError ? translateErrorSync(err, tErrors) : t("detail.errors.attach");
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const createNote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newContent.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await api.createNoteInSpace(space.id, { content: newContent.trim() });
      setNewContent("");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? translateErrorSync(err, tErrors)
          : t("detail.errors.create_note");
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const removeFromSpace = async (noteId: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.removeNoteFromSpace(space.id, noteId);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof ApiError ? translateErrorSync(err, tErrors) : t("detail.errors.remove");
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[74.88rem] flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/spaces"
        className="text-xs uppercase tracking-[0.18em] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
      >
        {t("detail.back")}
      </Link>
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-[var(--font-display)] text-3xl text-[var(--color-ink)]">
            {space.title}
          </h1>
          {space.description ? (
            <p className="mt-2 max-w-2xl text-sm text-[var(--color-ink-soft)]">
              {space.description}
            </p>
          ) : null}
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
            {t("note_count_one", { count: space.noteCount })}
          </p>
        </div>
      </header>

      <nav
        aria-label={tTabs("notes")}
        className="flex flex-wrap gap-1 border-b border-[var(--color-line)]"
      >
        {(["notes", "canvas", "outline"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={
              tab === value
                ? "border-b-2 border-[var(--color-accent)] px-3 py-2 text-sm font-medium text-[var(--color-accent)]"
                : "border-b-2 border-transparent px-3 py-2 text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
            }
          >
            {tTabs(value)}
          </button>
        ))}
      </nav>

      {tab === "notes" ? (
        <div className="flex flex-col gap-6">
          {error ? (
            <p role="alert" className="text-sm text-[var(--color-warn)]">
              {error}
            </p>
          ) : null}

          <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-5 sm:p-7">
            <h2 className="font-[var(--font-display)] text-lg text-[var(--color-ink)]">
              {t("detail.create_note_button")}
            </h2>
            <form onSubmit={createNote} className="flex flex-col gap-3">
              <textarea
                value={newContent}
                onChange={(event) => setNewContent(event.target.value)}
                rows={3}
                disabled={busy}
                placeholder={t("detail.create_note_placeholder")}
                className="w-full resize-y rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)]/60 px-4 py-3 text-base text-[var(--color-ink)] focus:border-[var(--color-accent)]"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={busy || newContent.trim().length === 0}
                  className="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-[var(--color-accent)]/90 disabled:opacity-60"
                >
                  {t("detail.create_note_submit")}
                </button>
              </div>
            </form>
          </section>

          <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-5 sm:p-7">
            <h2 className="font-[var(--font-display)] text-lg text-[var(--color-ink)]">
              {t("detail.add_existing_button")}
            </h2>
            <form onSubmit={searchExisting} className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("detail.add_existing_placeholder")}
                className="flex-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)]/60 px-4 py-2 text-base text-[var(--color-ink)] focus:border-[var(--color-accent)]"
              />
              <button
                type="submit"
                disabled={busy || search.trim().length === 0}
                className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-accent)] disabled:opacity-60"
              >
                {t("detail.add_existing_submit")}
              </button>
            </form>
            {searchResults.length > 0 ? (
              <ul className="mt-2 divide-y divide-[var(--color-line)]/60">
                {searchResults.map((note) => (
                  <li key={note.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                    <span className="font-[var(--font-display)] text-base text-[var(--color-ink)]">
                      {displayPreview(note.content, 100)}
                    </span>
                    <button
                      type="button"
                      onClick={() => attach(note.id)}
                      disabled={busy}
                      className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs font-medium text-[var(--color-ink)] hover:border-[var(--color-accent)] disabled:opacity-60"
                    >
                      {t("detail.add_existing_submit")}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          {notes.length === 0 ? (
            <p className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] bg-surface-soft p-10 text-center text-sm text-[var(--color-ink-soft)]">
              {t("detail.notes_empty")}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <NoteSection
                title={t("detail.notes_section_permanent")}
                notes={permanentNotes}
                onRemove={removeFromSpace}
                removeLabel={t("detail.remove_button")}
              />
              <NoteSection
                title={t("detail.notes_section_inbox")}
                notes={inboxNotes}
                onRemove={removeFromSpace}
                removeLabel={t("detail.remove_button")}
              />
            </div>
          )}
        </div>
      ) : tab === "canvas" ? (
        <section className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] bg-surface-soft p-10 text-center text-sm text-[var(--color-ink-soft)]">
          Canvas ships in Phase 3.
        </section>
      ) : (
        <section className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] bg-surface-soft p-10 text-center text-sm text-[var(--color-ink-soft)]">
          Outline ships later.
        </section>
      )}
    </main>
  );
}

function NoteSection({
  title,
  notes,
  onRemove,
  removeLabel,
}: {
  title: string;
  notes: NoteDto[];
  onRemove: (id: string) => void;
  removeLabel: string;
}) {
  if (notes.length === 0) {
    return (
      <section>
        <h3 className="text-xs uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
          {title}
        </h3>
        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">—</p>
      </section>
    );
  }
  return (
    <section>
      <h3 className="text-xs uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
        {title}
      </h3>
      <ol className="mt-3 divide-y divide-[var(--color-line)]/60 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface">
        {notes.map((note) => (
          <li
            key={note.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <Link
              href={`/notes/${encodeURIComponent(note.id)}`}
              className="font-[var(--font-display)] text-base text-[var(--color-ink)] hover:underline"
            >
              {displayPreview(note.content, 120)}
            </Link>
            <button
              type="button"
              onClick={() => onRemove(note.id)}
              className="rounded-full border border-[var(--color-line)] px-3 py-1 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-warn)] hover:text-[var(--color-warn)]"
            >
              {removeLabel}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
