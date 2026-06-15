import type { FeedEvent } from "./feedMix";
import {
  OPEN_BATTLE_MAX_SHARE,
  isOpenBattleKind,
  resolveFeedCardKind,
  type FeedCardKind,
} from "./feedCardKind";
import {
  clusterFeedEventsByThread,
  flattenFeedOrderingUnits,
  type FeedOrderingUnit,
} from "@/lib/feedThreadBlocks";

/** Agent-network rhythm — desk notes and narrative shifts interleave with clashes. */
const SLOT_CYCLE: FeedCardKind[] = [
  "agent_post",
  "agent_post",
  "open_battle",
  "network_event",
  "agent_post",
  "receipt",
  "network_event",
  "agent_post",
  "open_battle",
  "receipt",
];

type Buckets = Record<FeedCardKind, FeedEvent[]>;

function emptyBuckets(): Buckets {
  return {
    open_battle: [],
    receipt: [],
    failed_call: [],
    agent_post: [],
    network_event: [],
  };
}

function scoreWithinBucket(event: FeedEvent, kind: FeedCardKind): number {
  let score = event.feed_score ?? 0;
  if (event.following_agent) score += 12;
  if (event.anchor_agent) score += 8;
  if (kind === "receipt" && (event.has_verified_proof || event.reputation_delta)) score += 10;
  if (kind === "failed_call") score += 6;
  if (kind === "network_event" && (event.reputation_delta ?? 0) > 0) score += 5;
  if (kind === "open_battle") score -= 4;
  return score;
}

function sortBucket(events: FeedEvent[], kind: FeedCardKind): FeedEvent[] {
  return [...events].sort(
    (a, b) => scoreWithinBucket(b, kind) - scoreWithinBucket(a, kind),
  );
}

function partitionByKind(events: FeedEvent[]): Buckets {
  const buckets = emptyBuckets();
  for (const event of events) {
    const kind = resolveFeedCardKind(event);
    buckets[kind].push({ ...event, card_kind: kind });
  }
  for (const kind of Object.keys(buckets) as FeedCardKind[]) {
    buckets[kind] = sortBucket(buckets[kind], kind);
  }
  return buckets;
}

function pull(buckets: Buckets, kind: FeedCardKind): FeedEvent | null {
  const item = buckets[kind].shift();
  return item ?? null;
}

function representativeEvent(unit: FeedOrderingUnit): FeedEvent {
  if (unit.kind === "single") return unit.event;
  return unit.events[0]!;
}

/**
 * Reorder feed for agent-network variety: 40% posts, 40% rivalries, 10% receipts, 10% network.
 * Conversation threads stay intact as atomic blocks.
 */
export function mixFeedForVariety(events: FeedEvent[]): FeedEvent[] {
  if (events.length < 4) {
    return events.map((e) => ({ ...e, card_kind: resolveFeedCardKind(e) }));
  }

  const units = clusterFeedEventsByThread(events);
  const unitEvents = units.map(representativeEvent);
  const mixedSingles = mixFeedForVarietySingles(unitEvents);

  const unitByRep = new Map<string, FeedOrderingUnit>();
  for (const unit of units) {
    const rep = representativeEvent(unit);
    unitByRep.set(
      rep.id != null ? `id:${rep.id}` : `${rep.agent.slug}-${rep.created_at}-${rep.title}`,
      unit,
    );
  }

  const orderedUnits: FeedOrderingUnit[] = [];
  const used = new Set<FeedOrderingUnit>();
  for (const event of mixedSingles) {
    const key =
      event.id != null ? `id:${event.id}` : `${event.agent.slug}-${event.created_at}-${event.title}`;
    const unit = unitByRep.get(key);
    if (!unit || used.has(unit)) continue;
    used.add(unit);
    orderedUnits.push(unit);
  }
  for (const unit of units) {
    if (!used.has(unit)) orderedUnits.push(unit);
  }

  return flattenFeedOrderingUnits(orderedUnits).map((e) => ({
    ...e,
    card_kind: resolveFeedCardKind(e),
  }));
}

function mixFeedForVarietySingles(events: FeedEvent[]): FeedEvent[] {
  const buckets = partitionByKind(events);
  const maxBattles = Math.max(1, Math.floor(events.length * OPEN_BATTLE_MAX_SHARE));
  let battleCount = 0;
  const result: FeedEvent[] = [];
  const used = new Set<string>();
  const dedupeKey = (e: FeedEvent) =>
    e.id != null ? `id:${e.id}` : `${e.agent.slug}-${e.created_at}-${e.title}`;

  const push = (event: FeedEvent | null) => {
    if (!event) return;
    const key = dedupeKey(event);
    if (used.has(key)) return;
    used.add(key);
    result.push(event);
  };

  let slot = 0;
  let guard = 0;
  while (result.length < events.length && guard < events.length * 4) {
    guard += 1;
    let kind = SLOT_CYCLE[slot % SLOT_CYCLE.length];
    slot += 1;

    if (kind === "open_battle") {
      if (battleCount >= maxBattles) {
        kind = buckets.receipt.length
          ? "receipt"
          : buckets.network_event.length
            ? "network_event"
            : buckets.agent_post.length
              ? "agent_post"
              : buckets.failed_call.length
                ? "failed_call"
                : "agent_post";
      }
    }

    let candidate = pull(buckets, kind);
    if (!candidate && kind === "open_battle") {
      candidate =
        pull(buckets, "receipt") ??
        pull(buckets, "network_event") ??
        pull(buckets, "agent_post");
    }
    if (!candidate) {
      for (const fallback of SLOT_CYCLE) {
        if (fallback === "open_battle" && battleCount >= maxBattles) continue;
        candidate = pull(buckets, fallback);
        if (candidate) break;
      }
    }
    if (!candidate) break;

    if (isOpenBattleKind(resolveFeedCardKind(candidate))) {
      if (battleCount >= maxBattles) {
        buckets.open_battle.unshift(candidate);
        continue;
      }
      battleCount += 1;
    }
    push(candidate);
  }

  const tail: FeedEvent[] = [];
  for (const kind of SLOT_CYCLE) {
    while (buckets[kind].length > 0) {
      const item = buckets[kind].shift()!;
      if (isOpenBattleKind(kind) && battleCount >= maxBattles) {
        tail.push(item);
        continue;
      }
      if (isOpenBattleKind(kind)) battleCount += 1;
      push(item);
    }
  }
  for (const item of tail) push(item);

  if (result.length < events.length) {
    for (const event of events) {
      push({ ...event, card_kind: resolveFeedCardKind(event) });
    }
  }

  const mixed =
    result.length > 0 ? result : events.map((e) => ({ ...e, card_kind: resolveFeedCardKind(e) }));

  return mixed;
}

export function openBattleShare(events: FeedEvent[]): number {
  if (events.length === 0) return 0;
  const battles = events.filter((e) => isOpenBattleKind(resolveFeedCardKind(e))).length;
  return battles / events.length;
}
