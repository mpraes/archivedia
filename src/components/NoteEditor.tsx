"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ApiError, api } from "@/lib/api";
import { translateErrorSync } from "@/lib/errors-i18n";
import type { NoteDto } from "@/lib/note-dto";
import { formatLocalDateTime } from "@/lib/format";
import { ConfirmDialog } from "./ConfirmDialog";
import { LanguageSwitcher } from "./LanguageSwitcher";

interface NoteEditorProps {
  initialNote: NoteDto;
}

type Mode = "view" | "edit";

export function NoteEditor({ initialNote }: NoteEditorProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("note");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const [note, setNote] = useState<NoteDto>(initialNote);
  const [mode, setMode] = useState<Mode>("view");
  const [draft, setDraft] = useState(initialNote.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const startEdit = useCallback(() => {
    setDraft(note.content);
    setError(null);
    setMode("edit");
  }, [note.content]);

  const cancelEdit = useCallback(() => {
    setMode("view");
    setDraft(note.content);
    setError(null);
  }, [note.content]);

  const save = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      setError(t("empty_error"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.updateNote(note.id, trimmed);
      setNote(data);
      setMode("view");
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiError ? translateErrorSync(err, tErrors) : t("save_error");
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [draft, note.id, router, t, tErrors]);

  const confirmDelete = useCallback(async () => {
    setConfirmOpen(false);
    try {
      await api.deleteNote(note.id);
      router.push("/");
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiError ? translateErrorSync(err, tErrors) : t("delete_error");
      setError(message);
    }
  }, [note.id, router, t, tErrors]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex items-center justify-end">
        <LanguageSwitcher />
      </div>

      <nav className="flex items-center justify-between text-sm text-[var(--color-ink-soft)]">
        <Link href="/" className="rounded-full px-3 py-1 hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)]">
          {t("back")}
        </Link>
        <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-[10px] tracking-[0.18em] text-[var(--color-accent)]">
          {note.status}
        </span>
      </nav>

      <article className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-white/70 p-6 sm:p-8 shadow-[0_1px_0_rgba(0,0,0,0.02),0_12px_30px_-20px_rgba(0,0,0,0.15)]">
        <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--color-line)] pb-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
              {note.publicId}
            </p>
            <time dateTime={note.createdAt} className="text-sm text-[var(--color-ink-soft)]">
              {formatLocalDateTime(note.createdAt, locale)}
            </time>
          </div>
          {mode === "view" ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={startEdit}
                className="rounded-full border border-[var(--color-line)] bg-white px-4 py-1.5 text-sm hover:border-[var(--color-accent)]"
              >
                {t("edit")}
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="rounded-full border border-transparent px-4 py-1.5 text-sm text-[var(--color-warn)] hover:bg-[var(--color-warn)]/10"
              >
                {t("delete")}
              </button>
            </div>
          ) : null}
        </header>

        {mode === "view" ? (
          <p className="mt-5 whitespace-pre-wrap font-[var(--font-display)] text-lg leading-relaxed text-[var(--color-ink)]">
            {note.content}
          </p>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
            className="mt-5 flex flex-col gap-4"
          >
            <label htmlFor="edit-note" className="sr-only">
              {t("edit_label")}
            </label>
            <textarea
              id="edit-note"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={10}
              autoFocus
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "edit-error" : undefined}
              className="w-full resize-y rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)]/60 px-4 py-3 font-[var(--font-display)] text-lg leading-relaxed text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:bg-white"
            />
            {error ? (
              <p id="edit-error" role="alert" className="text-sm text-[var(--color-warn)]">
                {error}
              </p>
            ) : null}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-full border border-[var(--color-line)] bg-white px-4 py-2 text-sm hover:border-[var(--color-ink-soft)]"
              >
                {tCommon("cancel")}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent)]/90 disabled:opacity-60"
              >
                {saving ? tCommon("saving") : t("save_changes")}
              </button>
            </div>
          </form>
        )}
      </article>

      <ConfirmDialog
        open={confirmOpen}
        title={t("delete_title")}
        description={t("delete_description")}
        confirmLabel={t("delete")}
        cancelLabel={tCommon("cancel")}
        destructive
        onConfirm={() => void confirmDelete()}
        onCancel={() => setConfirmOpen(false)}
      />
    </main>
  );
}
