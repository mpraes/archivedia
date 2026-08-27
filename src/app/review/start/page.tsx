import { listReviewQueue } from "@/services/review-queue.service";
import { getNoteServiceDeps } from "@/services/dependencies";
import { ReviewCardScreen } from "@/components/ReviewCardScreen";

export const dynamic = "force-dynamic";

/**
 * Step 1.10: the one-at-a-time Review card. Server-rendered with the
 * current queue snapshot so the first paint is instant; the client
 * component advances through the list as the user resolves notes.
 */
export default async function ReviewStartPage() {
  const deps = getNoteServiceDeps();
  const result = await listReviewQueue(deps);
  return <ReviewCardScreen initialItems={result.items} />;
}
