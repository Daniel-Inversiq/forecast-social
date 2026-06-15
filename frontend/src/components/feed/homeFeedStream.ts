import type { FeedStreamItem } from "./arcThreadGroups";
import { buildFeedStreamItems } from "./arcThreadGroups";
import type { FeedEvent } from "./feedMix";

export type HomeFeedInterstitialKind =
  | "personal"
  | "stories"
  | "markets"
  | "public_reads";

export type HomeFeedStreamItem =
  | FeedStreamItem
  | { type: "interstitial"; id: string; kind: HomeFeedInterstitialKind };

/** Insert compact carousels into the feed so the home page reads as one stream. */
const INTERSTITIAL_SLOTS: { afterEventIndex: number; kind: HomeFeedInterstitialKind; id: string }[] = [
  { afterEventIndex: 0, kind: "personal", id: "personal" },
  { afterEventIndex: 2, kind: "stories", id: "stories" },
  { afterEventIndex: 5, kind: "markets", id: "markets" },
  { afterEventIndex: 8, kind: "public_reads", id: "public_reads" },
];

export function buildHomeFeedStreamItems(
  events: FeedEvent[],
  activeStoryKeys?: string[],
  options?: { includePersonal?: boolean },
): HomeFeedStreamItem[] {
  const base = buildFeedStreamItems(events, activeStoryKeys);
  const includePersonal = options?.includePersonal !== false;
  const slots = includePersonal
    ? INTERSTITIAL_SLOTS
    : INTERSTITIAL_SLOTS.filter((s) => s.kind !== "personal");

  let eventCount = -1;
  const out: HomeFeedStreamItem[] = [];
  let slotIdx = 0;

  for (const item of base) {
    if (item.type === "event") {
      eventCount += 1;
      out.push(item);
      while (slotIdx < slots.length && slots[slotIdx].afterEventIndex === eventCount) {
        const slot = slots[slotIdx];
        out.push({ type: "interstitial", id: slot.id, kind: slot.kind });
        slotIdx += 1;
      }
    } else {
      out.push(item);
    }
  }

  while (slotIdx < slots.length) {
    const slot = slots[slotIdx];
    if (eventCount >= slot.afterEventIndex - 1) {
      out.push({ type: "interstitial", id: slot.id, kind: slot.kind });
    }
    slotIdx += 1;
  }

  return out;
}
