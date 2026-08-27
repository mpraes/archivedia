import { PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logger";

// Reuse a single client across hot reloads in dev; create a fresh one in prod.
declare global {
  // eslint-disable-next-line no-var
  var __archivediaPrisma: PrismaClient | undefined;
}

const client = globalThis.__archivediaPrisma ?? new PrismaClient({ log: ["error", "warn"] });

if (process.env.NODE_ENV !== "production" && !globalThis.__archivediaPrisma) {
  logger.info("Prisma client initialised", { component: "db", op: "init" });
  globalThis.__archivediaPrisma = client;
}

export const prisma: PrismaClient = client;
