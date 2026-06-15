import type { FeedEvent } from "@/components/feed/feedMix";

/** Major receipt moments only — keep feed rare and prestigious. */
export function qualifiesForReceiptMomentFeed(event: FeedEvent): boolean {
  if (event.type !== "receipt" && event.type !== "verified_call") return false;

  const rep = event.reputation_delta ?? 0;
  const confidence = event.confidence ?? 0;
  const importance = event.importance_tier === "major" || event.interruptive_event;

  if (importance) return true;
  if (rep >= 20) return true;
  if (confidence >= 85) return true;
  if (event.has_verified_proof && confidence >= 78) return true;
  if (event.credibility_split?.consensus_breaking) return true;
  if ((event.following_agent ?? false) && confidence >= 72) return true;

  return false;
}

export function feedEventToReceiptId(event: FeedEvent): string | null {
  if (event.id != null && (event.type === "receipt" || event.type === "verified_call")) {
    return `receipt-event-${event.id}`;
  }
  return null;
}
