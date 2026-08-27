import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { logRequestError } from "@/lib/logger";
import { AppError, ErrorCode } from "./app-error";

/**
 * Convert any thrown value into the canonical error envelope. Unknown errors
 * are reported as 500 INTERNAL_ERROR and never leak stack traces to clients.
 */
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof AppError) {
    const body: { error: { code: string; message: string; fields?: Record<string, string> } } = {
      error: { code: err.code, message: err.message },
    };
    if (err.fields) body.error.fields = { ...err.fields };
    return NextResponse.json(body, { status: err.status });
  }

  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      if (!(key in fields)) fields[key] = issue.message;
    }
    return NextResponse.json(
      {
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: "Request validation failed.",
          fields,
        },
      },
      { status: 422 },
    );
  }

  logRequestError({
    detail: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  return NextResponse.json(
    { error: { code: ErrorCode.INTERNAL_ERROR, message: "Internal server error." } },
    { status: 500 },
  );
}
