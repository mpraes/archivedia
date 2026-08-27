"use client";

import { useTranslations } from "next-intl";

interface ReferenceFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Optional source citation for a note — book, link, article, video, or
 * any other free-form reference. Rendered as a single-line input on the
 * Today capture card, immediately below the "Why does this matter?"
 * field so the user can pin down the source of an idea without breaking
 * their capture flow.
 *
 * Mirrors the WhyCard visual treatment (same border, surface, optional
 * hint) so the two cards read as a stacked pair rather than two
 * unrelated widgets.
 */
export function ReferenceField({ value, onChange, disabled = false }: ReferenceFieldProps) {
  const t = useTranslations("reference");

  return (
    <section
      aria-labelledby="reference-label"
      className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-5 sm:p-7 shadow-[0_1px_0_rgba(0,0,0,0.02),0_12px_30px_-20px_rgba(0,0,0,0.15)]"
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2
          id="reference-label"
          className="font-[var(--font-display)] text-lg text-[var(--color-ink)]"
        >
          {t("title")}
        </h2>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
          {t("optional_hint")}
        </span>
      </div>
      <label htmlFor="reference-input" className="sr-only">
        {t("label")}
      </label>
      <input
        id="reference-input"
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("placeholder")}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)]/60 px-4 py-3 font-[var(--font-display)] text-base leading-relaxed text-[var(--color-ink)] placeholder:text-[var(--color-ink-soft)]/70 focus:border-[var(--color-accent)] focus:bg-surface disabled:opacity-60"
      />
    </section>
  );
}
