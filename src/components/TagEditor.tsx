"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ApiError, api } from "@/lib/api";
import { translateErrorSync } from "@/lib/errors-i18n";
import { TagChip } from "./TagChip";

interface TagEditorProps {
  noteId: string;
  initialTags: string[];
  onSaved?: (tags: string[]) => void;
}

const MAX_TAG_LENGTH = 32;

/**
 * Tag input that commits on Enter, comma, or blur. Backspace on an
 * empty field removes the last tag. Saves are debounced ~600ms after
 * the last edit to keep the wire quiet during fast typing; explicit
 * blur or Enter commits immediately.
 */
export function TagEditor({ noteId, initialTags, onSaved }: TagEditorProps) {
  const t = useTranslations("note");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const [tags, setTags] = useState<string[]>(initialTags);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep local state in sync when the parent refetches (e.g. after a
  // process flow completes and we want to surface the server's view).
  useEffect(() => {
    setTags(initialTags);
  }, [initialTags]);

  useEffect(() => {
    if (!confirmation) return;
    const id = window.setTimeout(() => setConfirmation(null), 2200);
    return () => window.clearTimeout(id);
  }, [confirmation]);

  const persist = useCallback(
    async (next: string[]) => {
      setSaving(true);
      setError(null);
      try {
        const { data } = await api.updateNote(noteId, { tags: next });
        setTags(data.tags);
        setConfirmation(next.length === 0 ? t("tags_cleared") : t("tags_saved"));
        onSaved?.(data.tags);
      } catch (err) {
        const message =
          err instanceof ApiError ? translateErrorSync(err, tErrors) : t("tags_save_error");
        setError(message);
      } finally {
        setSaving(false);
      }
    },
    [noteId, t, tErrors, onSaved],
  );

  const queueSave = useCallback(
    (next: string[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void persist(next);
      }, 600);
    },
    [persist],
  );

  const addTag = useCallback(
    (raw: string) => {
      const trimmed = raw.trim().toLowerCase();
      if (!trimmed) return;
      if (trimmed.length > MAX_TAG_LENGTH) return;
      if (tags.includes(trimmed)) {
        setDraft("");
        return;
      }
      const next = [...tags, trimmed];
      setTags(next);
      setDraft("");
      void persist(next);
    },
    [tags, persist],
  );

  const removeTag = useCallback(
    (tag: string) => {
      const next = tags.filter((entry) => entry !== tag);
      setTags(next);
      void persist(next);
    },
    [tags, persist],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter" || event.key === ",") {
        event.preventDefault();
        addTag(draft);
        return;
      }
      if (event.key === "Backspace" && draft.length === 0 && tags.length > 0) {
        event.preventDefault();
        const next = tags.slice(0, -1);
        setTags(next);
        void persist(next);
      }
    },
    [addTag, draft, tags, persist],
  );

  const onBlur = useCallback(() => {
    if (draft.trim().length > 0) addTag(draft);
  }, [addTag, draft]);

  return (
    <section aria-labelledby="tags-label" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="tags-label" className="font-[var(--font-display)] text-base text-[var(--color-ink)]">
          {t("tags_label")}
        </h3>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
          {saving ? tCommon("saving") : t("tags_hint")}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--color-line)] bg-surface px-3 py-2 focus-within:border-[var(--color-accent)] focus-within:bg-surface">
        {tags.map((tag) => (
          <TagChip key={tag} tag={tag} onRemove={() => removeTag(tag)} />
        ))}
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            if (next.includes(",")) addTag(next.replace(/,.*$/, ""));
            else queueSave(tags);
          }}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          placeholder={tags.length === 0 ? t("tags_placeholder") : ""}
          aria-label={t("tags_label")}
          className="min-w-[8ch] flex-1 bg-transparent text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-soft)]/70"
        />
        {draft.trim() ? (
          <span className="inline-flex items-center rounded-full border border-dashed border-[var(--color-line)] px-2 py-0.5 text-[11px] text-[var(--color-ink-soft)]">
            {draft.trim()}
          </span>
        ) : null}
      </div>

      <div aria-live="polite" className="min-h-[1.25rem] text-xs">
        {error ? (
          <p role="alert" className="text-[var(--color-warn)]">
            {error}
          </p>
        ) : confirmation ? (
          <p className="text-[var(--color-accent)]">{confirmation}</p>
        ) : tags.length === 0 ? (
          <p className="text-[var(--color-ink-soft)]">{t("tags_empty")}</p>
        ) : null}
      </div>
    </section>
  );
}
