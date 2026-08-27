"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

interface WhyCardProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export function WhyCard({
  value,
  onChange,
  onSubmit,
  disabled = false,
}: WhyCardProps) {
  const t = useTranslations("why");

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Same save shortcut as the main capture textarea so muscle memory works everywhere.
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (disabled) return;
        onSubmit();
      }
    },
    [disabled, onSubmit],
  );

  return (
    <section
      aria-labelledby="why-label"
      className="rounded-[var(--radius-card)] border border-[var(--color-line)] bg-surface p-5 sm:p-7 shadow-[0_1px_0_rgba(0,0,0,0.02),0_12px_30px_-20px_rgba(0,0,0,0.15)]"
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2
          id="why-label"
          className="font-[var(--font-display)] text-lg text-[var(--color-ink)]"
        >
          {t("title")}
        </h2>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-soft)]">
          {t("optional_hint")}
        </span>
      </div>
      <label htmlFor="why-textarea" className="sr-only">
        {t("label")}
      </label>
      <textarea
        id="why-textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("placeholder")}
        rows={3}
        disabled={disabled}
        className="w-full resize-y rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)]/60 px-4 py-3 font-[var(--font-display)] text-base leading-relaxed text-[var(--color-ink)] placeholder:text-[var(--color-ink-soft)]/70 focus:border-[var(--color-accent)] focus:bg-surface disabled:opacity-60"
      />
    </section>
  );
}
