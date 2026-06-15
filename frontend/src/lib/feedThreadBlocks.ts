import type { FeedEvent } from "@/components/feed/feedMix";

/** Events that share a thread_id form an atomic block for feed ordering. */
export type FeedThreadBlock = {
  kind: "thread";
  threadId: string;
  events: FeedEvent[];
};

export type FeedOrderingUnit =
  | { kind: "single"; event: FeedEvent }
  | FeedThreadBlock;

function threadBlockKey(event: FeedEvent): string | null {
  if (!event.thread_id || !event.generated_activity_id) return null;
  return event.thread_id;
}

/** Cluster generated conversation rows so variety mix cannot split them. */
export function clusterFeedEventsByThread(events: FeedEvent[]): FeedOrderingUnit[] {
  const byThread = new Map<string, FeedEvent[]>();
  for (const event of events) {
    const key = threadBlockKey(event);
    if (!key) continue;
    const list = byThread.get(key) ?? [];
    list.push(event);
    byThread.set(key, list);
  }

  const consumedThreads = new Set<string>();
  const units: FeedOrderingUnit[] = [];

  for (const event of events) {
    const key = threadBlockKey(event);
    if (!key) {
      units.push({ kind: "single", event });
      continue;
    }
    if (consumedThreads.has(key)) continue;
    consumedThreads.add(key);
    const batch = byThread.get(key) ?? [event];
    if (batch.length <= 1) {
      units.push({ kind: "single", event: batch[0]! });
      continue;
    }
    units.push({
      kind: "thread",
      threadId: key,
      events: [...batch].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)),
    });
  }

  return units.length ? units : events.map((event) => ({ kind: "single" as const, event }));
}

export function flattenFeedOrderingUnits(units: FeedOrderingUnit[]): FeedEvent[] {
  const out: FeedEvent[] = [];
  for (const unit of units) {
    if (unit.kind === "single") {
      out.push(unit.event);
    } else {
      out.push(...unit.events);
    }
  }
  return out;
}
