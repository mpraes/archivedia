import { listReviewQueue } from "@/services/review-queue.service";
import { getNoteServiceDeps } from "@/services/dependencies";
import { ReviewQueueScreen } from "@/components/ReviewQueueScreen";

export const dynamic = "force-dynamic";

/**
 * FR-30: the Review entry view. Shows how many notes are waiting and
 * offers a single "Start review" action. The actual one-at-a-time
 * decision card lives behind that button in Step 1.10.
 */
export default async function ReviewPage() {
  const deps = getNoteServiceDeps();
  const result = await listReviewQueue(deps);
  return (
    <ReviewQueueScreen
      total={result.total}
      firstItems={result.items.slice(0, 5)}
    />
  );
}
