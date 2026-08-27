"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ApiError, api, type ReviewQueueItemDto } from "@/lib/api";
import { translateErrorSync } from "@/lib/errors-i18n";

type Decision = "permanent" | "project" | "inbox" | "delete";

interface ReviewCardScreenProps {
  /**
   * Pre-fetched queue snapshot. The card screen keeps its own pointer
   * into this list and removes items as the user resolves them. When
   * the list empties, the screen swaps to a "queue empty" panel.
   */
  initialItems: ReviewQueueItemDto[];
}

/**
 * Structural skeleton for Step 1.10. Visual polish (typography,
 * spacing, motion, the exact card layout) is owned by the designer;
 * this file wires up state, API calls, and accessibility scaffolding
 * so the design has a stable contract to render against.
 */
export function ReviewCardScreen({ initialItems }: ReviewCardScreenProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("review");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");

  const [items, setItems] = useState<ReviewQueueItemDto[]>(initialItems);
  const [index, setIndex] = useState(0);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = items[index];
  const total = items.length;
  const isDone = total === 0 || index >= total;

  const dismissCurrent = useCallback(() => {
    setItems((prev) => prev.slice(1));
    setIndex(0);
    setDecision(null);
    setError(null);
  }, []);

  const refresh = useCallback(() => router.refresh(), [router]);

  const decide = useCallback(
    async (next: Decision) => {
      if (!current || busy) return;
      setBusy(true);
      setError(null);
      try {
        if (next === "permanent") {
          setDecision("permanent");
          return;
        }
        if (next === "inbox") {
          setDecision("inbox");
          return;
        }
        if (next === "delete") {
          await api.deleteNote(current.id);
          dismissCurrent();
          refresh();
          return;
        }
        // "project" is reserved for Phase 2 (Spaces). Until then, drop
        // the user back into the queue with a soft message.
        setDecision("project");
      } catch (err) {
        const message =
          err instanceof ApiError ? translateErrorSync(err, tErrors) : t("errors.delete");
        setError(message);
      } finally {
        setBusy(false);
      }
    },
    [busy, current, dismissCurrent, refresh, tErrors, t],
  );

  const confirmMakePermanent = useCallback(
    async (content: string, whyItMatters: string | null) => {
      if (!current) return;
      setBusy(true);
      setError(null);
      try {
        await api.makePermanent(current.id, { content, whyItMatters });
        dismissCurrent();
        refresh();
      } catch (err) {
        const message =
          err instanceof ApiError
            ? translateErrorSync(err, tErrors)
            : t("errors.save_permanent");
        setError(message);
      } finally {
        setBusy(false);
        setDecision(null);
      }
    },
    [current, dismissCurrent, refresh, tErrors, t],
  );

  const confirmDefer = useCallback(
    async (nextReviewAt: string, reason: string | null) => {
      if (!current) return;
      setBusy(true);
      setError(null);
      try {
        await api.deferReview(current.id, { nextReviewAt, reason: reason ?? undefined });
        dismissCurrent();
        refresh();
      } catch (err) {
        const message =
          err instanceof ApiError ? translateErrorSync(err, tErrors) : t("errors.defer");
        setError(message);
      } finally {
        setBusy(false);
        setDecision(null);
      }
    },
    [current, dismissCurrent, refresh, tErrors, t],
  );

  useEffect(() => {
    // If the user resolves every note without leaving, the router refresh
    // eventually overwrites the prop with an empty array — keep state in sync.
    if (initialItems.length === 0 && items.length > 0) {
      setItems([]);
    }
  }, [initialItems, items.length]);

  const capturedAt = useMemo(() => {
    if (!current) return null;
    return {
      date: new Intl.DateTimeFormat(locale, {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(new Date(current.createdAt)),
      time: new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(current.createdAt)),
    };
  }, [current, locale]);

  if (isDone) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[46rem] flex-col gap-6 px-4 py-10 sm:px-6 sm:py-16">
        <section className="review-fade-in rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-8 text-center sm:p-10">
          <h1 className="font-[var(--font-display)] text-2xl text-[var(--color-ink)]">
            {t("prompts.progress_done")}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-ink-soft)]">
            {t("prompts.progress_done_description")}
          </p>
          <div className="mt-6">
            <Link
              href="/review"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-surface px-5 py-2.5 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              {t("prompts.back_to_queue")}
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[46rem] flex-col gap-8 px-4 py-10 sm:px-6 sm:py-16">
      <style>{`
        @keyframes review-fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .review-fade-in {
          animation: review-fade-in 0.35s ease-out both;
        }
        @media (prefers-reduced-motion: reduce) {
          .review-fade-in {
            animation: none;
          }
        }
      `}</style>

      <header className="review-fade-in flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--color-ink-soft)]">
            {t("title")}
          </p>
          <h1 className="font-[var(--font-display)] text-2xl text-[var(--color-ink)]">
            {t("card_progress", { current: index + 1, total })}
          </h1>
          {capturedAt ? (
            <p className="pt-1 text-xs text-[var(--color-ink-soft)]">
              {t("captured_on", { date: capturedAt.date, time: capturedAt.time })} ·{" "}
              {t("waiting_for", {
                value: t("waiting_days_value", {
                  count: Math.max(1, Math.floor(current.waitingSinceHours / 24)),
                }),
              })}
            </p>
          ) : null}
        </div>
        <Link
          href="/review"
          className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-ink)]"
        >
          {tCommon("cancel")}
        </Link>
      </header>

      <article className="review-fade-in rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-6 shadow-[0_1px_0_rgba(0,0,0,0.02),0_18px_40px_-24px_rgba(0,0,0,0.18)] sm:p-8">
        <p className="whitespace-pre-wrap font-[var(--font-display)] text-lg leading-relaxed text-[var(--color-ink)]">
          {current.content}
        </p>
        {current.whyItMatters ? (
          <div className="mt-6 border-t border-[var(--color-line)]/70 pt-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
              {t("why_it_matters_heading")}
            </p>
            <p className="mt-2 text-base leading-relaxed text-[var(--color-ink)]">
              {current.whyItMatters}
            </p>
          </div>
        ) : null}
      </article>

      <section key={decision ?? "grid"} className="review-fade-in space-y-4">
        {decision === null ? (
          <>
            <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
              {t("prompts.keep_permanent")}
            </h2>
            <DecisionGrid
              disabled={busy}
              onDecide={decide}
              tActions={(key) => t(`actions.${key}`)}
            />
          </>
        ) : decision === "permanent" ? (
          <MakePermanentForm
            initialContent={current.content}
            initialWhy={current.whyItMatters}
            disabled={busy}
            onCancel={() => setDecision(null)}
            onSubmit={confirmMakePermanent}
          />
        ) : decision === "inbox" ? (
          <DeferForm
            disabled={busy}
            onCancel={() => setDecision(null)}
            onSubmit={confirmDefer}
          />
        ) : (
          // "project" is reserved for Phase 2 (Spaces). Until Spaces ship,
          // show a soft message and let the user pick a different decision.
          <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] bg-surface-soft p-6 text-center text-sm text-[var(--color-ink-soft)]">
            <p>{t("prompts.keep_permanent")}</p>
            <button
              type="button"
              onClick={() => setDecision(null)}
              className="mt-3 inline-flex items-center gap-1.5 text-[var(--color-accent)] underline underline-offset-4 transition-colors hover:text-[var(--color-ink)]"
            >
              <span aria-hidden="true">←</span> {t("prompts.make_permanent_cancel")}
            </button>
          </div>
        )}
      </section>

      {error ? (
        <p role="alert" className="review-fade-in text-sm text-[var(--color-warn)]">
          {error}
        </p>
      ) : null}
    </main>
  );
}

function DecisionGrid({
  disabled,
  onDecide,
  tActions,
}: {
  disabled: boolean;
  onDecide: (decision: Decision) => void;
  tActions: (key: string) => string;
}) {
  // Designer-owned: layout, hierarchy, button affordances.
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onDecide("permanent")}
        className="group relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-accent)]/30 bg-surface p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-accent)] hover:shadow-[0_8px_24px_-16px_rgba(0,0,0,0.18)] disabled:opacity-60 disabled:hover:translate-y-0"
      >
        <span className="block font-[var(--font-display)] text-base font-medium text-[var(--color-ink)] transition-colors group-hover:text-[var(--color-accent)]">
          {tActions("keep_permanent")}
        </span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onDecide("project")}
        className="group rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-accent)]/50 hover:shadow-[0_8px_24px_-16px_rgba(0,0,0,0.14)] disabled:opacity-60 disabled:hover:translate-y-0"
      >
        <span className="block font-[var(--font-display)] text-base font-medium text-[var(--color-ink)]">
          {tActions("add_to_project")}
        </span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onDecide("inbox")}
        className="group rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-accent)]/50 hover:shadow-[0_8px_24px_-16px_rgba(0,0,0,0.14)] disabled:opacity-60 disabled:hover:translate-y-0"
      >
        <span className="block font-[var(--font-display)] text-base font-medium text-[var(--color-ink)]">
          {tActions("keep_in_inbox")}
        </span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onDecide("delete")}
        className="group rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-warn)]/40 hover:bg-[var(--color-warn)]/[0.06] hover:shadow-[0_8px_24px_-16px_rgba(0,0,0,0.14)] disabled:opacity-60 disabled:hover:translate-y-0"
      >
        <span className="block font-[var(--font-display)] text-base font-medium text-[var(--color-ink-soft)] transition-colors group-hover:text-[var(--color-warn)]">
          {tActions("delete")}
        </span>
      </button>
    </div>
  );
}

interface MakePermanentFormProps {
  initialContent: string;
  initialWhy: string | null;
  disabled: boolean;
  onCancel: () => void;
  onSubmit: (content: string, whyItMatters: string | null) => Promise<void>;
}

function MakePermanentForm({
  initialContent,
  initialWhy,
  disabled,
  onCancel,
  onSubmit,
}: MakePermanentFormProps) {
  const t = useTranslations("review");
  const [content, setContent] = useState(initialContent);
  const [why, setWhy] = useState(initialWhy ?? "");

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      await onSubmit(content.trim(), why.trim() || null);
    },
    [content, onSubmit, why],
  );

  return (
    <form
      onSubmit={submit}
      className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-6 shadow-[0_1px_0_rgba(0,0,0,0.02),0_18px_40px_-24px_rgba(0,0,0,0.18)] sm:p-8"
    >
      <div className="mb-5">
        <h2 className="font-[var(--font-display)] text-xl text-[var(--color-ink)]">
          {t("prompts.make_permanent_title")}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-soft)]">
          {t("prompts.make_permanent_hint")}
        </p>
      </div>

      <div className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
            {t("prompts.make_permanent_content_label")}
          </span>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={6}
            disabled={disabled}
            className="w-full resize-y rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)]/60 px-4 py-3 font-[var(--font-display)] text-base leading-relaxed text-[var(--color-ink)] transition-colors placeholder:text-[var(--color-ink-soft)]/50 focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/30 disabled:opacity-60"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
            {t("prompts.make_permanent_why_label")}
          </span>
          <textarea
            value={why}
            onChange={(event) => setWhy(event.target.value)}
            rows={3}
            disabled={disabled}
            className="w-full resize-y rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)]/60 px-4 py-3 text-base leading-relaxed text-[var(--color-ink)] transition-colors placeholder:text-[var(--color-ink-soft)]/50 focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/30 disabled:opacity-60"
          />
        </label>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm font-medium text-[var(--color-ink)] transition-all hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-60"
        >
          {t("prompts.make_permanent_cancel")}
        </button>
        <button
          type="submit"
          disabled={disabled || content.trim().length === 0}
          className="rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[var(--color-accent)]/90 hover:shadow-md disabled:opacity-60"
        >
          {t("prompts.make_permanent_save")}
        </button>
      </div>
    </form>
  );
}

interface DeferFormProps {
  disabled: boolean;
  onCancel: () => void;
  onSubmit: (nextReviewAt: string, reason: string | null) => Promise<void>;
}

function DeferForm({ disabled, onCancel, onSubmit }: DeferFormProps) {
  const t = useTranslations("review");
  type Preset = "tomorrow" | "in3" | "nextWeek" | "custom";
  const [preset, setPreset] = useState<Preset>("in3");
  const [customDate, setCustomDate] = useState("");
  const [reason, setReason] = useState("");

  const computeNext = useCallback((): Date | null => {
    const now = new Date();
    if (preset === "tomorrow") {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      return d;
    }
    if (preset === "in3") {
      const d = new Date(now);
      d.setDate(d.getDate() + 3);
      return d;
    }
    if (preset === "nextWeek") {
      const d = new Date(now);
      d.setDate(d.getDate() + 7);
      return d;
    }
    if (!customDate) return null;
    const parsed = new Date(customDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [customDate, preset]);

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const next = computeNext();
      if (!next) return;
      await onSubmit(next.toISOString(), reason.trim() || null);
    },
    [computeNext, onSubmit, reason],
  );

  return (
    <form
      onSubmit={submit}
      className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-6 shadow-[0_1px_0_rgba(0,0,0,0.02),0_18px_40px_-24px_rgba(0,0,0,0.18)] sm:p-8"
    >
      <h2 className="font-[var(--font-display)] text-xl text-[var(--color-ink)]">
        {t("prompts.defer_title")}
      </h2>

      <fieldset className="mt-5">
        <legend className="sr-only">{t("prompts.defer_subtitle")}</legend>
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
          {t("prompts.defer_subtitle")}
        </p>
        <div className="flex flex-wrap gap-2">
          {(["tomorrow", "in3", "nextWeek", "custom"] as const).map((value) => {
            const selected = preset === value;
            return (
              <label
                key={value}
                className={`cursor-pointer select-none rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                  selected
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white shadow-sm"
                    : "border-[var(--color-line)] bg-[var(--color-paper)]/40 text-[var(--color-ink)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-paper)]/80"
                } ${disabled ? "opacity-60" : ""}`}
              >
                <input
                  type="radio"
                  name="defer-preset"
                  value={value}
                  checked={selected}
                  onChange={() => setPreset(value)}
                  disabled={disabled}
                  className="sr-only"
                />
                {t(
                  value === "tomorrow"
                    ? "prompts.defer_tomorrow"
                    : value === "in3"
                      ? "prompts.defer_in_3_days"
                      : value === "nextWeek"
                        ? "prompts.defer_next_week"
                        : "prompts.defer_custom_label",
                )}
              </label>
            );
          })}
        </div>
      </fieldset>

      {preset === "custom" ? (
        <label className="mt-4 block">
          <span className="sr-only">{t("prompts.defer_custom_label")}</span>
          <input
            type="date"
            value={customDate}
            onChange={(event) => setCustomDate(event.target.value)}
            disabled={disabled}
            className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)]/60 px-4 py-2.5 text-base text-[var(--color-ink)] transition-colors focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/30 disabled:opacity-60"
          />
        </label>
      ) : null}

      <label className="mt-5 block">
        <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
          {t("prompts.defer_reason_label")}
        </span>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          disabled={disabled}
          className="w-full resize-y rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)]/60 px-4 py-3 text-base leading-relaxed text-[var(--color-ink)] transition-colors placeholder:text-[var(--color-ink-soft)]/50 focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/30 disabled:opacity-60"
        />
      </label>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="rounded-full border border-[var(--color-line)] px-5 py-2.5 text-sm font-medium text-[var(--color-ink)] transition-all hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-60"
        >
          {t("prompts.make_permanent_cancel")}
        </button>
        <button
          type="submit"
          disabled={disabled || (preset === "custom" && !customDate)}
          className="rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[var(--color-accent)]/90 hover:shadow-md disabled:opacity-60"
        >
          {t("prompts.defer_save")}
        </button>
      </div>
    </form>
  );
}
