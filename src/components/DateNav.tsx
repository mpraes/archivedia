"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { shiftDate } from "@/lib/format";

interface DateNavProps {
  date: string;
  todayDate: string;
}

export function DateNav({ date, todayDate }: DateNavProps) {
  const t = useTranslations("dateNav");
  const router = useRouter();

  const navigate = useCallback(
    (target: string) => {
      router.push(`/?date=${target}`);
    },
    [router],
  );

  const onChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) navigate(value);
    },
    [navigate],
  );

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-ink-soft)]">
      <button
        type="button"
        onClick={() => navigate(shiftDate(date, -1))}
        aria-label={t("prev")}
        className="rounded-full border border-[var(--color-line)] bg-white px-3 py-1 hover:border-[var(--color-accent)]"
      >
        ←
      </button>
      <label className="flex items-center gap-2">
        <span className="sr-only">{t("date_label")}</span>
        <input
          type="date"
          value={date}
          onChange={onChange}
          lang={t("date_label") === "Date" ? "en" : "pt-BR"}
          className="rounded-full border border-[var(--color-line)] bg-white px-3 py-1 text-sm text-[var(--color-ink)]"
        />
      </label>
      <button
        type="button"
        onClick={() => navigate(shiftDate(date, 1))}
        aria-label={t("next")}
        className="rounded-full border border-[var(--color-line)] bg-white px-3 py-1 hover:border-[var(--color-accent)]"
      >
        →
      </button>
      <button
        type="button"
        onClick={() => navigate(todayDate)}
        disabled={date === todayDate}
        className="ml-1 rounded-full border border-transparent px-3 py-1 text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] disabled:opacity-40"
      >
        {t("today")}
      </button>
    </div>
  );
}
