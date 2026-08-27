import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Transport from "winston-transport";
import { logDbFailure, logStartup, logger } from "./logger";

/**
 * Test transport that captures the post-pipeline entry. The Logger in
 * `logger.ts` already attaches a `timestamp()` + `errors({stack:true})`
 * format, so we do NOT pass a per-transport `format` here — doing so
 * would override the Logger's pipeline and drop `ts` from the entry.
 */
class CapturingTransport extends Transport {
  records: object[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log(info: any, callback: () => void): void {
    this.records.push(info);
    callback();
  }
}

function withCapturingTransport(): { records: object[]; detach: () => void } {
  const records: object[] = [];
  const transport = new CapturingTransport({});
  const originalLog = transport.log.bind(transport);
  transport.log = (info, callback) => {
    records.push(info);
    originalLog(info, callback);
  };
  logger.add(transport);
  return { records, detach: () => logger.remove(transport) };
}

describe("logger", () => {
  let capture: { records: object[]; detach: () => void };

  beforeEach(() => {
    capture = withCapturingTransport();
  });

  afterEach(() => {
    capture.detach();
  });

  it("emits a startup record with the right level, message, and meta", () => {
    logStartup({ timezone: "America/Sao_Paulo" });
    expect(capture.records).toHaveLength(1);
    const record = capture.records[0] as Record<string, unknown>;
    expect(record.level).toBe("info");
    expect(record.message).toBe("archivedia backend initialised");
    expect(record.timezone).toBe("America/Sao_Paulo");
    expect(record.component).toBe("bootstrap");
  });

  it("captures database failure context with op and error shape", () => {
    const failure = new Error("connection refused");
    logDbFailure({ op: "insert", err: failure, noteId: "abc" });
    expect(capture.records).toHaveLength(1);
    const record = capture.records[0] as Record<string, unknown>;
    expect(record.level).toBe("error");
    expect(record.message).toBe("Database operation failed");
    expect(record.component).toBe("db");
    expect(record.op).toBe("insert");
    expect(record.noteId).toBe("abc");
    const error = record.error as { name: string; message: string };
    expect(error.name).toBe("Error");
    expect(error.message).toBe("connection refused");
  });

  it("does not attach the console transport when NODE_ENV is test", () => {
    // vitest sets NODE_ENV=test before module load; the module-level
    // guard in `logger.ts` must therefore have skipped the console
    // transport. This test pins that invariant.
    const hasConsole = logger.transports.some(
      (t) => t.constructor.name === "Console",
    );
    expect(hasConsole).toBe(false);
  });
});
