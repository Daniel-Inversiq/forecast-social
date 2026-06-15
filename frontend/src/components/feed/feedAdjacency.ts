import type { FeedEvent } from "./feedMix";
import { resolveFeedCardKind, type FeedCardKind } from "./feedCardKind";

function kindOf(event: FeedEvent): FeedCardKind {
  return resolveFeedCardKind(event);
}

function isTooSimilar(a: FeedEvent, b: FeedEvent): boolean {
  const ka = kindOf(a);
  const kb = kindOf(b);
  if (a.agent.slug === b.agent.slug) return true;
  if (ka === "receipt" && kb === "failed_call") return true;
  if (ka === "failed_call" && kb === "receipt") return true;
  if (ka !== kb) return false;
  if (ka === "network_event" && a.type === b.type) return true;
  return true;
}

/** Prevent back-to-back cards that look or read the same. */
export function separateAdjacentFeedItems(events: FeedEvent[]): FeedEvent[] {
  if (events.length < 2) return events;
  const out = [...events];

  for (let i = 1; i < out.length; i++) {
    if (!isTooSimilar(out[i - 1], out[i])) continue;

    let swapIdx = -1;
    for (let j = i + 1; j < out.length; j++) {
      if (!isTooSimilar(out[i - 1], out[j]) && !isTooSimilar(out[j], out[i + 1] ?? out[j])) {
        swapIdx = j;
        break;
      }
    }
    if (swapIdx < 0) {
      for (let j = i + 1; j < out.length; j++) {
        if (!isTooSimilar(out[i - 1], out[j])) {
          swapIdx = j;
          break;
        }
      }
    }
    if (swapIdx > i) {
      [out[i], out[swapIdx]] = [out[swapIdx], out[i]];
    }
  }

  return out;
}
