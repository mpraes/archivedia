import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { themeInitScript } from "@/components/ThemeToggle";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f5ef",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Pin the request locale so next-intl's server APIs work consistently
  // across static and dynamic routes; without this, descendants may desync.
  const locale = await getLocale();
  setRequestLocale(locale);

  const messages = await getMessages();
  const tCommon = await getTranslations("common");

  return (
    <html lang={locale}>
      <head>
        {/*
         * Theme attribute must be set before React mounts to avoid a
         * flash of the wrong palette on dark-mode devices. Inline script
         * reads localStorage / prefers-color-scheme synchronously.
         */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <a
            href="#capture"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:bg-white focus:px-3 focus:py-2 focus:rounded-md focus:shadow"
          >
            {tCommon("skip_link")}
          </a>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
