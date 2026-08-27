import { toErrorResponse } from "@/errors/error-handler";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse | Response> {
  try {
    let database: "connected" | "unreachable" = "connected";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      database = "unreachable";
      logger.warn("Database ping failed", {
        component: "health",
        op: "db_ping",
        error: err instanceof Error ? { name: err.name, message: err.message } : { value: String(err) },
      });
    }
    return Response.json({
      status: database === "connected" ? "ok" : "degraded",
      service: "headapp-api",
      timestamp: new Date().toISOString(),
      database,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
