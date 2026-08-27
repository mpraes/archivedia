import winston from "winston";

/**
 * Application-wide structured logger.
 *
 * Every log line is a single JSON object with at least `level`, `message`,
 * and `ts` (ISO 8601 UTC). Callers may attach arbitrary meta fields
 * (`component`, `op`, etc.) so downstream shippers (Loki, Vector, etc.)
 * can route and filter without parsing English prose.
 *
 * Tests run with `NODE_ENV=test`, in which case the console transport is
 * not attached; tests that need to assert against log output should
 * register their own transport on the exported `logger` instance and
 * clean it up in `afterEach`.
 */

const isTest = process.env.NODE_ENV === "test";

const consoleFormat = winston.format.printf((info) => {
  const { level, message, ts, ...rest } = info as winston.Logform.TransformableInfo & {
    ts: string;
  };
  return JSON.stringify({ level, message, ts, ...rest });
});

export const logger: winston.Logger = winston.createLogger({
  levels: { error: 0, warn: 1, info: 2, debug: 3 },
  level: process.env.LOG_LEVEL ?? "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
  ),
  // Silent by default in tests so the suite output stays readable; production
  // and dev runs always log to stdout.
  transports: isTest
    ? []
    : [new winston.transports.Console({ format: consoleFormat })],
});

export interface StartupMeta {
  timezone: string;
  [key: string]: unknown;
}

/**
 * Log the one-line startup banner emitted from `app.ts` when the wiring
 * comes up. Kept distinct from a generic `info` so log shippers can
 * route cold-start events to a separate stream.
 */
export function logStartup(meta: StartupMeta): void {
  logger.info("archivedia backend initialised", { ...meta, component: "bootstrap" });
}

export interface RequestErrorMeta {
  detail: string;
  stack?: string;
  [key: string]: unknown;
}

/**
 * Log an unhandled error inside a route handler before it is converted
 * to the canonical 500 JSON envelope.
 */
export function logRequestError(meta: RequestErrorMeta): void {
  logger.error("Unhandled error in route handler", { ...meta, component: "http" });
}

export interface DbFailureMeta {
  op: string;
  err: unknown;
  [key: string]: unknown;
}

/**
 * Log a database failure (transient connection error, query failure, etc.)
 * before the service layer translates it into a 503 response. The `op`
 * field names the repository call that failed (e.g. `insert`, `patchNote`).
 */
export function logDbFailure(meta: DbFailureMeta): void {
  const { op, err, ...rest } = meta;
  const errInfo =
    err instanceof Error
      ? { name: err.name, message: err.message, stack: err.stack }
      : { value: String(err) };
  logger.error("Database operation failed", {
    ...rest,
    component: "db",
    op,
    error: errInfo,
  });
}
