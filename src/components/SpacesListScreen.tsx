"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ApiError, api, type SpaceDto } from "@/lib/api";
import { translateErrorSync } from "@/lib/errors-i18n";
import { daysBetween } from "@/lib/format";

interface SpacesListScreenProps {
  initialSpaces: SpaceDto[];
}

export function SpacesListScreen({ initialSpaces }: SpacesListScreenProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("spaces");
  const tErrors = useTranslations("errors");
  const [spaces, setSpaces] = useState<SpaceDto[]>(initialSpaces);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (title.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.createSpace({
        title: title.trim(),
        description: description.trim() || undefined,
      });
      setSpaces((prev) => [{ ...data, noteCount: 0 }, ...prev]);
      setTitle("");
      setDescription("");
      setCreating(false);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof ApiError ? translateErrorSync(err, tErrors) : t("errors.create");
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[74.88rem] flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
            {t("title")}
          </p>
          <h1 className="mt-1 font-[var(--font-display)] text-3xl text-[var(--color-ink)]">
            {t("title")}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setCreating((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--color-accent)]/90"
        >
          {t("new_button")}
        </button>
      </header>

      {creating ? (
        <form
          onSubmit={submit}
          className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-5 sm:p-7"
        >
          <label className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
              {t("form_title_label")}
            </span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={busy}
              required
              maxLength={200}
              className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)]/60 px-4 py-3 text-base text-[var(--color-ink)] focus:border-[var(--color-accent)]"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
              {t("form_description_label")}
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={busy}
              rows={3}
              maxLength={2000}
              className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)]/60 px-4 py-3 text-base text-[var(--color-ink)] focus:border-[var(--color-accent)]"
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-[var(--color-warn)]">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setCreating(false)}
              disabled={busy}
              className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-accent)] disabled:opacity-60"
            >
              {t("form_cancel")}
            </button>
            <button
              type="submit"
              disabled={busy || title.trim().length === 0}
              className="rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-[var(--color-accent)]/90 disabled:opacity-60"
            >
              {t("form_create")}
            </button>
          </div>
        </form>
      ) : null}

      {spaces.length === 0 ? (
        <section className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] bg-surface-soft p-10 text-center">
          <p className="font-[var(--font-display)] text-lg text-[var(--color-ink)]">
            {t("empty_title")}
          </p>
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
            {t("empty_description")}
          </p>
        </section>
      ) : (
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {spaces.map((space) => (
            <li
              key={space.id}
              className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-5 shadow-[0_1px_0_rgba(0,0,0,0.02),0_12px_30px_-20px_rgba(0,0,0,0.15)]"
            >
              <Link href={`/spaces/${encodeURIComponent(space.id)}`} className="block">
                <h2 className="font-[var(--font-display)] text-xl text-[var(--color-ink)]">
                  {space.title}
                </h2>
                {space.description ? (
                  <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
                    {space.description}
                  </p>
                ) : null}
                <p className="mt-3 text-xs text-[var(--color-ink-soft)]">
                  {t("note_count_one", { count: space.noteCount })} ·{" "}
                  {t("last_updated", { when: formatUpdated(space.updatedAt, locale, t) })}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

function formatUpdated(
  iso: string,
  locale: string,
  t: (key: string, values?: Record<string, number>) => string,
): string {
  const days = daysBetween(iso, new Date());
  if (days <= 0) return t("updated_today");
  if (days === 1) return t("updated_yesterday");
  return t("updated_days_ago_one", { count: days });
  void locale; // locale unused for now (i18n strings drive phrasing)
}
