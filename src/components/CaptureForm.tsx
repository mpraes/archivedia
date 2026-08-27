"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ApiError, api } from "@/lib/api";
import { translateErrorSync } from "@/lib/errors-i18n";
import type { NoteDto } from "@/lib/note-dto";
import { ReferenceField } from "./ReferenceField";
import { WhyCard } from "./WhyCard";

interface CaptureFormProps {
  onSaved: (note: NoteDto) => void;
}

const EMPTY = "";

export function CaptureForm({ onSaved }: CaptureFormProps) {
  const t = useTranslations("capture");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState(EMPTY);
  const [why, setWhy] = useState(EMPTY);
  const [reference, setReference] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  // FR-03: focar o campo de captura assim que a página estiver interativa.
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!confirmation) return;
    const id = window.setTimeout(() => setConfirmation(null), 2200);
    return () => window.clearTimeout(id);
  }, [confirmation]);

  const submit = useCallback(async () => {
    const trimmed = content.trim();
    if (trimmed.length === 0) {
      setError(t("empty_error"));
      return;
    }
    // The "Why does this matter?" answer and the source citation are
    // both sent as separate fields (whyItMatters, reference) so the list
    // preview does not need to regex-strip sentinel blocks out of the
    // content body. The API normalises empty strings to null.
    const whyTrimmed = why.trim();
    const referenceTrimmed = reference.trim();
    setError(null);
    setSubmitting(true);
    try {
      const { data } = await api.createNote(
        trimmed,
        undefined,
        whyTrimmed || null,
        referenceTrimmed || null,
      );
      setContent(EMPTY);
      setWhy(EMPTY);
      setReference(EMPTY);
      setConfirmation(t("saved"));
      onSaved(data);
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch (err) {
      const message =
        err instanceof ApiError
          ? translateErrorSync(err, tErrors)
          : t("save_error");
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [content, why, reference, onSaved, t, tErrors]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // FR-05: Ctrl+Enter no Windows/Linux, Cmd+Enter no macOS.
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (submitting) return;
        void submit();
      }
    },
    [submit, submitting],
  );

  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <div className="flex flex-col gap-6">
      <section
        id="capture"
        aria-labelledby="capture-label"
        className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-5 sm:p-7 shadow-[0_1px_0_rgba(0,0,0,0.02),0_12px_30px_-20px_rgba(0,0,0,0.15)]"
      >
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h1
            id="capture-label"
            className="font-[var(--font-display)] text-2xl sm:text-3xl text-[var(--color-ink)]"
          >
            {t("title")}
          </h1>
          <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
            {isMac
              ? tCommon("today_shortcut_mac")
              : tCommon("today_shortcut_other")}
          </span>
        </div>

        <label htmlFor="capture-textarea" className="sr-only">
          {t("label")}
        </label>
        <textarea
          id="capture-textarea"
          ref={textareaRef}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("placeholder")}
          rows={6}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? "capture-error" : undefined}
          className="w-full resize-y rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)]/60 px-4 py-3 font-[var(--font-display)] text-lg leading-relaxed text-[var(--color-ink)] placeholder:text-[var(--color-ink-soft)]/70 focus:border-[var(--color-accent)] focus:bg-surface"
        />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div aria-live="polite" className="min-h-[1.25rem] text-sm">
            {error ? (
              <p
                id="capture-error"
                role="alert"
                className="text-[var(--color-warn)]"
              >
                {error}
              </p>
            ) : confirmation ? (
              <p className="text-[var(--color-accent)]">{confirmation}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--color-accent)]/90 disabled:opacity-60"
          >
            {submitting ? tCommon("saving") : t("save_button")}
          </button>
        </div>
      </section>

      <WhyCard
        value={why}
        onChange={setWhy}
        onSubmit={submit}
        disabled={submitting}
      />

      <ReferenceField value={reference} onChange={setReference} disabled={submitting} />
    </div>
  );
}
