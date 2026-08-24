import { PrismaClient } from "@prisma/client";

// Reuse a single client across hot reloads in dev; create a fresh one in prod.
declare global {
  // eslint-disable-next-line no-var
  var __archivediaPrisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__archivediaPrisma ?? new PrismaClient({ log: ["error", "warn"] });

if (process.env.NODE_ENV !== "production") {
  globalThis.__archivediaPrisma = prisma;
}
