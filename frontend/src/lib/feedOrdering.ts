import type { FeedEvent } from "@/components/feed/feedMix";
import { groupThreadedFeedEvents } from "@/lib/activityThreadLayout";

/** Primary liveness timestamp for feed ordering (matches backend latest mode). */
export function feedSortTimestamp(event: FeedEvent): number {
  const raw = event.feed_published_at ?? event.created_at;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

export function isLatestFeedChip(chip: string): boolean {
  return chip.toLowerCase().replace(/\s+/g, "_") === "latest";
}

export function dedupeFeedEvents(events: FeedEvent[]): FeedEvent[] {
  const seenIds = new Set<number>();
  const seenGenerated = new Set<string>();
  const out: FeedEvent[] = [];

  for (const event of events) {
    if (event.id != null && seenIds.has(event.id)) continue;
    if (event.generated_activity_id && seenGenerated.has(event.generated_activity_id)) continue;
    if (event.id != null) seenIds.add(event.id);
    if (event.generated_activity_id) seenGenerated.add(event.generated_activity_id);
    out.push(event);
  }

  return out;
}

export function sortFeedByPublishTimeDesc(events: FeedEvent[]): FeedEvent[] {
  return [...events].sort((a, b) => feedSortTimestamp(b) - feedSortTimestamp(a));
}

function partitionFeedThreadBlocks(events: FeedEvent[]): FeedEvent[][] {
  const blocks: FeedEvent[][] = [];
  let index = 0;

  while (index < events.length) {
    const current = events[index]!;
    const isThreadRoot =
      Boolean(current.thread_id) &&
      Boolean(current.generated_activity_id) &&
      current.thread_id === current.generated_activity_id;

    if (!isThreadRoot) {
      blocks.push([current]);
      index += 1;
      continue;
    }

    const block: FeedEvent[] = [current];
    index += 1;
    while (index < events.length) {
      const next = events[index]!;
      if (next.thread_id !== current.thread_id) break;
      block.push(next);
      index += 1;
    }

    const hasReply = block.some(
      (event) =>
        event.parent_activity_id != null &&
        event.generated_activity_id !== event.thread_id,
    );
    if (block.length > 1 || hasReply) {
      blocks.push(block);
    } else {
      blocks.push([current]);
    }
  }

  return blocks;
}

/** Group threads adjacently, then order blocks by the newest item in each block. */
export function sortFeedByThreadBlockTimeDesc(events: FeedEvent[]): FeedEvent[] {
  const grouped = groupThreadedFeedEvents(events);
  const blocks = partitionFeedThreadBlocks(grouped);
  blocks.sort((a, b) => {
    const aLatest = Math.max(...a.map((event) => feedSortTimestamp(event)));
    const bLatest = Math.max(...b.map((event) => feedSortTimestamp(event)));
    return bLatest - aLatest;
  });
  return blocks.flat();
}

export function countThreadBlocksRendered(events: FeedEvent[]): number {
  return partitionFeedThreadBlocks(groupThreadedFeedEvents(events)).filter(
    (block) =>
      block.length > 1 ||
      block.some(
        (event) =>
          event.parent_activity_id != null &&
          event.generated_activity_id !== event.thread_id,
      ),
  ).length;
}

export function timestampsAreDescending(events: FeedEvent[]): boolean {
  for (let i = 1; i < events.length; i++) {
    if (feedSortTimestamp(events[i - 1]) < feedSortTimestamp(events[i])) {
      return false;
    }
  }
  return true;
}
