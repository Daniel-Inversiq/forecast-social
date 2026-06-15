import type { FeedEvent } from "@/components/feed/feedMix";
import { resolveFeedCardKind, type FeedCardKind } from "@/components/feed/feedCardKind";
import { isConversationReply } from "@/lib/conversationReply";
import { feedSortTimestamp, isLatestFeedChip } from "@/lib/feedOrdering";

export type NearDuplicateSuppression = {
  reason: "near_duplicate";
  agent_slug: string;
  normalized_title: string;
  card_kind_bucket: string;
  feed_item_id?: number;
  generated_activity_id?: string;
  display_order: number;
  suppressed_in_favor_of: {
    feed_item_id?: number;
    generated_activity_id?: string;
  };
};

export type NearDuplicateDebug = {
  winner: true;
  normalized_title: string;
  suppressed_count: number;
  suppressed: NearDuplicateSuppression[];
};

/** Normalize titles for near-duplicate matching. */
export function normalizeFeedTitle(title: string | null | undefined): string {
  if (!title?.trim()) return "";
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cardKindBucket(kind: FeedCardKind): string {
  if (kind === "receipt" || kind === "failed_call") return kind;
  return "content";
}

function feedEventIdentity(event: FeedEvent): string {
  if (event.id != null) return `id:${event.id}`;
  if (event.generated_activity_id) return `gen:${event.generated_activity_id}`;
  return `anon:${event.agent.slug}:${event.created_at}:${event.title}`;
}

function getThreadBlockIndices(events: FeedEvent[], index: number): number[] {
  const threadId = events[index]?.thread_id;
  if (!threadId) return [index];
  let start = index;
  while (start > 0 && events[start - 1]?.thread_id === threadId) start -= 1;
  let end = index;
  while (end < events.length - 1 && events[end + 1]?.thread_id === threadId) end += 1;
  return Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
}

/** Thread replies with distinct parent_activity_id chains stay visible. */
export function isThreadReplyNearDuplicateExempt(
  event: FeedEvent,
  events: FeedEvent[],
  index: number,
): boolean {
  if (!isConversationReply(event) || !event.thread_id || !event.parent_activity_id) {
    return false;
  }
  const blockIndices = getThreadBlockIndices(events, index);
  if (blockIndices.length < 2) return false;

  const parentIds = new Set(
    blockIndices
      .map((i) => events[i]?.parent_activity_id)
      .filter((id): id is string => Boolean(id)),
  );
  return parentIds.size > 1;
}

export function nearDuplicateKey(
  event: FeedEvent,
  events: FeedEvent[],
  index: number,
): string | null {
  if (isThreadReplyNearDuplicateExempt(event, events, index)) return null;

  const normalized = normalizeFeedTitle(event.title);
  if (!normalized) return null;

  const bucket = cardKindBucket(resolveFeedCardKind(event));
  return `${event.agent.slug}::${normalized}::${bucket}`;
}

function pickNearDuplicateWinner(a: FeedEvent, b: FeedEvent, chip: string): FeedEvent {
  if (isLatestFeedChip(chip)) {
    return feedSortTimestamp(a) >= feedSortTimestamp(b) ? a : b;
  }
  const scoreA = a.feed_score ?? 0;
  const scoreB = b.feed_score ?? 0;
  if (scoreA !== scoreB) return scoreA > scoreB ? a : b;
  return feedSortTimestamp(a) >= feedSortTimestamp(b) ? a : b;
}

function eventRef(event: FeedEvent): {
  feed_item_id?: number;
  generated_activity_id?: string;
} {
  return {
    feed_item_id: event.id,
    generated_activity_id: event.generated_activity_id,
  };
}

/**
 * Render-time dedupe: same agent_slug + normalized_title within the visible window.
 * Receipts are not deduped against posts (separate card_kind buckets).
 */
export function suppressNearDuplicateFeedEvents(
  events: FeedEvent[],
  chip: string,
  suppressionsOut?: NearDuplicateSuppression[],
): FeedEvent[] {
  if (events.length < 2) return events;

  const groups = new Map<
    string,
    { winner: FeedEvent; winnerIndex: number; suppressed: NearDuplicateSuppression[] }
  >();

  for (let index = 0; index < events.length; index++) {
    const event = events[index]!;
    const key = nearDuplicateKey(event, events, index);
    if (!key) continue;

    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { winner: event, winnerIndex: index, suppressed: [] });
      continue;
    }

    const winner = pickNearDuplicateWinner(existing.winner, event, chip);
    const loser = winner === existing.winner ? event : existing.winner;
    const winnerIndex = winner === existing.winner ? existing.winnerIndex : index;
    const loserIndex = winner === existing.winner ? index : existing.winnerIndex;
    const normalized = normalizeFeedTitle(loser.title);

    const suppression: NearDuplicateSuppression = {
      reason: "near_duplicate",
      agent_slug: loser.agent.slug,
      normalized_title: normalized,
      card_kind_bucket: cardKindBucket(resolveFeedCardKind(loser)),
      feed_item_id: loser.id,
      generated_activity_id: loser.generated_activity_id,
      display_order: loserIndex,
      suppressed_in_favor_of: eventRef(winner),
    };

    groups.set(key, {
      winner,
      winnerIndex,
      suppressed: [...existing.suppressed, suppression],
    });
  }

  const winnerIds = new Set<string>();
  const winnerDebug = new Map<string, NearDuplicateDebug>();

  for (const { winner, suppressed } of groups.values()) {
    winnerIds.add(feedEventIdentity(winner));
    if (suppressed.length > 0) {
      winnerDebug.set(feedEventIdentity(winner), {
        winner: true,
        normalized_title: normalizeFeedTitle(winner.title),
        suppressed_count: suppressed.length,
        suppressed,
      });
      suppressionsOut?.push(...suppressed);
    }
  }

  // Events without a near-dup key are always kept.
  for (let index = 0; index < events.length; index++) {
    const event = events[index]!;
    if (nearDuplicateKey(event, events, index)) continue;
    winnerIds.add(feedEventIdentity(event));
  }

  const result: FeedEvent[] = [];
  for (const event of events) {
    const identity = feedEventIdentity(event);
    if (!winnerIds.has(identity)) continue;

    const debug = winnerDebug.get(identity);
    if (debug) {
      result.push({ ...event, near_duplicate_debug: debug });
    } else {
      result.push(event);
    }
  }

  return result;
}
