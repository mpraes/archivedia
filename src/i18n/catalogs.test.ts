import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { locales } from "@/i18n/config";

/**
 * Guard rail: every locale must ship every key the default locale uses.
 * If you add a new translation key in pt-BR.json, the same key must be
 * added to every other catalog or this test will fail.
 */
function loadMessages(locale: string): Record<string, unknown> {
  const file = path.join(process.cwd(), "messages", `${locale}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
}

function collectKeys(node: unknown, prefix = ""): string[] {
  if (node === null || typeof node !== "object") return [];
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      return collectKeys(value, next);
    }
    return [next];
  });
}

describe("i18n catalogs", () => {
  it("has a JSON file for every declared locale", () => {
    for (const locale of locales) {
      expect(() => loadMessages(locale)).not.toThrow();
    }
  });

  it("ships every key the default locale uses", () => {
    const base = collectKeys(loadMessages("pt-BR")).sort();
    for (const locale of locales) {
      if (locale === "pt-BR") continue;
      const keys = collectKeys(loadMessages(locale)).sort();
      expect(keys, `messages/${locale}.json is missing keys`).toEqual(base);
    }
  });
});
