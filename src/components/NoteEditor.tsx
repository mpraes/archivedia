"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ApiError, api } from "@/lib/api";
import { translateErrorSync } from "@/lib/errors-i18n";
import type { NoteDto } from "@/lib/note-dto";
import { formatLocalDateTime } from "@/lib/format";
import { BacklinksPanel } from "./BacklinksPanel";
import { ConfirmDialog } from "./ConfirmDialog";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LinkifiedText } from "./LinkifiedText";
import { TagEditor } from "./TagEditor";
import { ThemeToggle } from "./ThemeToggle";

interface NoteEditorProps {
  initialNote: NoteDto;
}

type Mode = "view" | "edit" | "process";

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
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const startEdit = useCallback(() => {
    setDraft(note.content);
    setError(null);
    setMode("edit");
  }, [note.content]);

  const startProcess = useCallback(() => {
    setDraft(note.content);
    setError(null);
    setMode("process");
  }, [note.content]);

  const cancelEdit = useCallback(() => {
    setMode("view");
    setDraft(note.content);
    setError(null);
  }, [note.content]);

  const cancelProcess = useCallback(() => {
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
      const { data } = await api.updateNote(note.id, { content: trimmed });
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

  const process = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      setError(t("empty_error"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.processNote(note.id, trimmed);
      setNote(data);
      setMode("view");
      setConfirmation(t("processed_toast"));
      router.refresh();
    } catch (err) {
      const message = err instanceof ApiError ? translateErrorSync(err, tErrors) : t("process_error");
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

  const canProcess = note.status === "inbox";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex items-center justify-end gap-2">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>

      <nav className="flex items-center justify-between text-sm text-[var(--color-ink-soft)]">
        <Link href="/" className="rounded-full px-3 py-1 hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)]">
          {t("back")}
        </Link>
        <StatusBadge status={note.status} />
      </nav>

      <article className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-6 sm:p-8 shadow-[0_1px_0_rgba(0,0,0,0.02),0_12px_30px_-20px_rgba(0,0,0,0.15)]">
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
            <div className="flex flex-wrap items-center gap-2">
              {canProcess ? (
                <button
                  type="button"
                  onClick={startProcess}
                  className="rounded-full bg-[var(--color-accent)] px-4 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-accent)]/90"
                >
                  {t("process_button")}
                </button>
              ) : null}
              <button
                type="button"
                onClick={startEdit}
                className="rounded-full border border-[var(--color-line)] bg-surface px-4 py-1.5 text-sm hover:border-[var(--color-accent)]"
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
          <div className="mt-5 whitespace-pre-wrap font-[var(--font-display)] text-lg leading-relaxed text-[var(--color-ink)]">
            <LinkifiedText content={note.content} />
          </div>
        ) : mode === "edit" ? (
          <EditorForm
            id="edit-note"
            label={t("edit_label")}
            draft={draft}
            onChange={setDraft}
            onSubmit={save}
            onCancel={cancelEdit}
            submitting={saving}
            error={error}
            submitLabel={t("save_changes")}
            submittingLabel={tCommon("saving")}
            cancelLabel={tCommon("cancel")}
            errorId="edit-error"
          />
        ) : (
          <ProcessForm
            draft={draft}
            onChange={setDraft}
            onSubmit={process}
            onCancel={cancelProcess}
            submitting={saving}
            error={error}
            heading={t("process_title")}
            hint={t("process_hint")}
            label={t("process_label")}
            submitLabel={t("process_save")}
            submittingLabel={tCommon("saving")}
            cancelLabel={tCommon("cancel")}
          />
        )}

        <div aria-live="polite" className="mt-3 min-h-[1.25rem] text-sm">
          {confirmation && mode === "view" ? (
            <p className="text-[var(--color-accent)]">{confirmation}</p>
          ) : null}
        </div>
      </article>

      <TagEditor
        noteId={note.id}
        initialTags={[...note.tags]}
        onSaved={(tags) => setNote((prev) => ({ ...prev, tags }))}
      />

      <BacklinksPanel noteId={note.id} />

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

interface EditorFormProps {
  id: string;
  label: string;
  draft: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
  error: string | null;
  submitLabel: string;
  submittingLabel: string;
  cancelLabel: string;
  errorId: string;
}

function EditorForm({
  id,
  label,
  draft,
  onChange,
  onSubmit,
  onCancel,
  submitting,
  error,
  submitLabel,
  submittingLabel,
  cancelLabel,
  errorId,
}: EditorFormProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!submitting) onSubmit();
      }}
      className="mt-5 flex flex-col gap-4"
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <textarea
        id={id}
        value={draft}
        onChange={(event) => onChange(event.target.value)}
        rows={10}
        autoFocus
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? errorId : undefined}
        className="w-full resize-y rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)]/60 px-4 py-3 font-[var(--font-display)] text-lg leading-relaxed text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:bg-surface"
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-[var(--color-warn)]">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-[var(--color-line)] bg-surface px-4 py-2 text-sm hover:border-[var(--color-ink-soft)]"
        >
          {cancelLabel}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent)]/90 disabled:opacity-60"
        >
          {submitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}

interface ProcessFormProps {
  draft: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
  error: string | null;
  heading: string;
  hint: string;
  label: string;
  submitLabel: string;
  submittingLabel: string;
  cancelLabel: string;
}

function ProcessForm({
  draft,
  onChange,
  onSubmit,
  onCancel,
  submitting,
  error,
  heading,
  hint,
  label,
  submitLabel,
  submittingLabel,
  cancelLabel,
}: ProcessFormProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!submitting) onSubmit();
      }}
      className="mt-5 flex flex-col gap-4"
    >
      <header className="flex flex-col gap-1">
        <h2 className="font-[var(--font-display)] text-lg text-[var(--color-ink)]">{heading}</h2>
        <p className="text-sm text-[var(--color-ink-soft)]">{hint}</p>
      </header>
      <label htmlFor="process-note" className="sr-only">
        {label}
      </label>
      <textarea
        id="process-note"
        value={draft}
        onChange={(event) => onChange(event.target.value)}
        rows={12}
        autoFocus
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? "process-error" : undefined}
        className="w-full resize-y rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)]/60 px-4 py-3 font-[var(--font-display)] text-lg leading-relaxed text-[var(--color-ink)] focus:border-[var(--color-accent)] focus:bg-surface"
      />
      {error ? (
        <p id="process-error" role="alert" className="text-sm text-[var(--color-warn)]">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-[var(--color-line)] bg-surface px-4 py-2 text-sm hover:border-[var(--color-ink-soft)]"
        >
          {cancelLabel}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-accent)]/90 disabled:opacity-60"
        >
          {submitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}

import type { NoteStatus } from "@/domain/note-status";

function StatusBadge({ status }: { status: NoteStatus }) {
  const label = status === "permanent" ? "permanent" : status;
  const tone =
    status === "permanent"
      ? "border border-[var(--color-line)] bg-[var(--color-paper)] text-[var(--color-ink-soft)]"
      : "bg-[var(--color-accent-soft)] text-[var(--color-accent)]";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] tracking-[0.18em] ${tone}`}>
      {label}
    </span>
  );
}
