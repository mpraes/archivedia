import type { NextRequest } from "next/server";
import { toErrorResponse } from "@/errors/error-handler";
import { reviewQueueQuerySchema } from "@/schemas/note.schema";
import { listReviewQueue } from "@/services/review-queue.service";
import { getNoteServiceDeps } from "@/services/dependencies";

/**
 * FR-30 / FR-31: list inbox notes that have crossed the 48-hour review
 * gate. The `meta.readyForReview` counter drives the Today alert banner
 * (FR-28) so the front-end does not need a second endpoint just to know
 * the queue size.
 */
export async function GET(req: NextRequest): Promise<Response> {
  try {
    const url = new URL(req.url);
    const query = reviewQueueQuerySchema.parse({
      limit: url.searchParams.get("limit") ?? undefined,
    });
    const deps = getNoteServiceDeps();
    const result = await listReviewQueue(deps, { limit: query.limit });
    return Response.json({
      data: result.items,
      meta: {
        readyForReview: result.total,
        returned: result.items.length,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
