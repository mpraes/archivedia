import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCurrentLocale } from "@/lib/i18n";

export default async function NotFound() {
  const locale = await getCurrentLocale();
  setRequestLocale(locale);
  const t = await getTranslations("notFound");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-[var(--font-display)] text-2xl text-[var(--color-ink)]">{t("title")}</h1>
      <p className="text-sm text-[var(--color-ink-soft)]">{t("description")}</p>
      <Link
        href="/"
        className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white"
      >
        {t("back")}
      </Link>
    </main>
  );
}
