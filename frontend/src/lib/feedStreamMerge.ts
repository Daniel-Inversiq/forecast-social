import type { FeedEvent } from "@/components/feed/feedMix";
import { enrichFeedEvent, enrichFeedRanking } from "@/components/feed/feedEnrichment";
import { feedLoadLog } from "@/lib/feedLoadLog";
import { filterFeed } from "@/components/feed/feedMix";
import { separateAdjacentFeedItems } from "@/components/feed/feedAdjacency";
import { resolveFeedCardKind } from "@/components/feed/feedCardKind";
import { mixFeedForVariety } from "@/components/feed/feedVarietyMix";
import {
  applyThreadDepthToFeedEvents,
  attachThreadParentContext,
} from "@/lib/activityThreadLayout";
import {
  dedupeFeedEvents,
  isLatestFeedChip,
  sortFeedByThreadBlockTimeDesc,
} from "@/lib/feedOrdering";
import {
  suppressNearDuplicateFeedEvents,
  type NearDuplicateSuppression,
} from "@/lib/feedNearDuplicate";

/** Streamed events stay pinned above ranking for this window. */
export const STREAM_PRIORITY_MS = 3 * 60 * 1000;

const DEV = process.env.NODE_ENV === "development";

export function feedStreamLog(...args: unknown[]) {
  if (DEV) console.log("[feed-stream]", ...args);
}

export function tagStreamedEvent(event: FeedEvent): FeedEvent {
  return {
    ...enrichFeedEvent(event),
    is_streamed: true,
    streamed_at: Date.now(),
    show_new: true,
  };
}

export function isStreamPriorityActive(event: FeedEvent, now = Date.now()): boolean {
  if (!event.is_streamed || event.streamed_at == null) return false;
  return now - event.streamed_at < STREAM_PRIORITY_MS;
}

function eventDedupeKey(event: FeedEvent): string {
  if (event.id != null) return `id:${event.id}`;
  return `${event.agent.slug}-${event.created_at}-${event.title}`;
}

function rankRest(events: FeedEvent[], chip: string): FeedEvent[] {
  if (isLatestFeedChip(chip)) {
    return sortFeedByThreadBlockTimeDesc(
      events.map((e) => enrichFeedEvent({ ...e, feed_mode: "latest" })),
    );
  }
  if (chip === "For You") {
    const hasScores = events.some((e) => e.feed_score != null);
    if (!hasScores) return enrichFeedRanking(events);
    return events.map((e) => enrichFeedEvent({ ...e, feed_mode: "for_you" }));
  }
  return filterFeed(events, chip);
}

/** Surface at least one receipt in the first few slots (home above-the-fold). */
export function ensureReceiptNearTop(events: FeedEvent[], maxIndex = 2): FeedEvent[] {
  if (events.length < 2) return events;
  const receiptIdx = events.findIndex((e) => resolveFeedCardKind(e) === "receipt");
  if (receiptIdx < 0 || receiptIdx <= maxIndex) return events;
  const out = [...events];
  const [receipt] = out.splice(receiptIdx, 1);
  const insertAt = Math.min(maxIndex, out.length);
  out.splice(insertAt, 0, receipt);
  return out;
}

/** Streamed (fresh) first, then ranked feed. Dedupes by event id. */
export function orderFeedForDisplay(
  events: FeedEvent[],
  chip: string,
  now = Date.now(),
  options?: {
    homeFeed?: boolean;
    nearDuplicateSuppressions?: NearDuplicateSuppression[];
  },
): FeedEvent[] {
  feedLoadLog("orderFeedForDisplay start", {
    input: events.length,
    chip,
    homeFeed: options?.homeFeed ?? false,
  });
  const latestMode = isLatestFeedChip(chip);
  const deduped = dedupeFeedEvents(events);

  let ordered: FeedEvent[];

  if (latestMode) {
    ordered = sortFeedByThreadBlockTimeDesc(
      deduped.map((e) => enrichFeedEvent({ ...e, feed_mode: "latest" })),
    );
    ordered = applyThreadDepthToFeedEvents(ordered);
    ordered = attachThreadParentContext(ordered);
  } else {
    const seen = new Set<string>();
    const streamed: FeedEvent[] = [];
    const rest: FeedEvent[] = [];

    for (const e of deduped) {
      const key = eventDedupeKey(e);
      if (seen.has(key)) continue;
      seen.add(key);

      if (isStreamPriorityActive(e, now)) {
        streamed.push(e);
      } else {
        rest.push(e);
      }
    }

    streamed.sort((a, b) => (b.streamed_at ?? 0) - (a.streamed_at ?? 0));

    const rankedRest = rankRest(rest, chip);
    const streamedKeys = new Set(streamed.map(eventDedupeKey));
    const filteredRanked = rankedRest.filter((e) => !streamedKeys.has(eventDedupeKey(e)));

    const shouldVarietyMix = chip === "For You" || chip === "All";
    const mixed = shouldVarietyMix ? mixFeedForVariety(filteredRanked) : filteredRanked;

    ordered = separateAdjacentFeedItems([...streamed, ...mixed]);
  }

  const nearDeduped = suppressNearDuplicateFeedEvents(
    ordered,
    chip,
    options?.nearDuplicateSuppressions,
  );

  if (options?.nearDuplicateSuppressions?.length && DEV) {
    feedStreamLog(
      "near-duplicate suppressions",
      options.nearDuplicateSuppressions.length,
      options.nearDuplicateSuppressions,
    );
  }

  feedLoadLog("orderFeedForDisplay done", { output: nearDeduped.length });
  return nearDeduped;
}

export type InsertStreamResult = { events: FeedEvent[]; inserted: boolean; duplicate: boolean };

export function insertStreamedEvent(
  events: FeedEvent[],
  incoming: FeedEvent,
  max = 80,
): InsertStreamResult {
  const tagged = tagStreamedEvent(incoming);
  const key = eventDedupeKey(tagged);

  if (tagged.id != null) {
    const idx = events.findIndex((e) => e.id === tagged.id);
    if (idx >= 0) {
      const without = events.filter((_, i) => i !== idx);
      feedStreamLog("event inserted (re-promoted)", tagged.id, tagged.title?.slice(0, 40));
      return { events: [tagged, ...without].slice(0, max), inserted: true, duplicate: false };
    }
  } else if (events.some((e) => eventDedupeKey(e) === key)) {
    feedStreamLog("duplicate skipped", key);
    return { events, inserted: false, duplicate: true };
  }

  feedStreamLog("event inserted", tagged.id ?? key, tagged.title?.slice(0, 40));
  return { events: [tagged, ...events].slice(0, max), inserted: true, duplicate: false };
}

/** Preserve stream metadata when REST refresh replaces the feed array. */
export function mergeFetchedWithStreamState(fetched: FeedEvent[], current: FeedEvent[]): FeedEvent[] {
  const streamMeta = new Map<
    number,
    Pick<FeedEvent, "streamed_at" | "is_streamed" | "show_new">
  >();
  for (const e of current) {
    if (e.id != null && e.streamed_at != null) {
      streamMeta.set(e.id, {
        streamed_at: e.streamed_at,
        is_streamed: e.is_streamed,
        show_new: e.show_new,
      });
    }
  }

  const seen = new Set<string>();
  const merged: FeedEvent[] = [];

  for (const e of fetched) {
    const key = eventDedupeKey(e);
    if (seen.has(key)) continue;
    seen.add(key);
    if (e.id != null && streamMeta.has(e.id)) {
      merged.push({ ...e, ...streamMeta.get(e.id)! });
    } else {
      merged.push(e);
    }
  }

  return merged;
}

export function clearExpiredStreamFlags(events: FeedEvent[], now = Date.now()): FeedEvent[] {
  return events.map((e) => {
    if (!e.is_streamed || e.streamed_at == null) return e;
    if (now - e.streamed_at < STREAM_PRIORITY_MS) return e;
    const { show_new: _, is_streamed: __, streamed_at: ___, ...rest } = e;
    return rest;
  });
}

export function clearShowNew(events: FeedEvent[], ids: number[]): FeedEvent[] {
  const idSet = new Set(ids);
  return events.map((e) => (e.id != null && idSet.has(e.id) ? { ...e, show_new: false } : e));
}
