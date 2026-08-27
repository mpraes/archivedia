// Composition root for the headapp/archivedia backend.
//
// In Next.js App Router the route handlers under src/app/api/** are the
// actual HTTP entry points; this file documents the wiring contract so
// non-Next runtimes (a future standalone server or test harness) can
// reuse the same controllers and services without rewiring them.

import { logStartup } from "@/lib/logger";
import { getNoteServiceDeps } from "@/services/dependencies";

export interface AppContext {
  timezone: string;
  ready: boolean;
}

let bootstrapped = false;

export function bootstrap(): AppContext {
  if (bootstrapped) return { timezone: getNoteServiceDeps().timezone, ready: true };
  bootstrapped = true;
  // The Prisma client is lazy-initialised; touching the deps here fails
  // fast if DATABASE_URL is missing so we surface misconfiguration early.
  const timezone = getNoteServiceDeps().timezone;
  logStartup({ timezone });
  return { timezone, ready: true };
}
