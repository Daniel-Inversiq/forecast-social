import type { FeedEvent } from "@/components/feed/feedMix";
import { resolveAgentFeedCopy } from "@/lib/feedAgentCopy";
import type { GeneratedActivityItem } from "@/lib/generatedFeed";
import { MAX_THREAD_DEPTH } from "@/lib/threadConstants";

export function resolveThreadDepth(
  item: { activity_id: string; parent_activity_id?: string | null },
  byId: Map<string, Pick<GeneratedActivityItem, "parent_activity_id">>,
): number {
  let depth = 1;
  let parentId = item.parent_activity_id ?? null;
  const seen = new Set<string>();
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    depth += 1;
    parentId = parent.parent_activity_id ?? null;
  }
  return depth;
}

/** Attach thread_depth for generated activity cards (max depth from MAX_THREAD_DEPTH). */
export function applyThreadDepthToFeedEvents(events: FeedEvent[]): FeedEvent[] {
  const byGeneratedId = new Map<
    string,
    Pick<GeneratedActivityItem, "activity_id" | "parent_activity_id">
  >();
  for (const event of events) {
    if (event.generated_activity_id) {
      byGeneratedId.set(event.generated_activity_id, {
        activity_id: event.generated_activity_id,
        parent_activity_id: event.parent_activity_id ?? null,
      });
    }
  }
  if (byGeneratedId.size === 0) return events;

  return events.map((event) => {
    if (!event.generated_activity_id) return event;
    const depth = Math.min(
      MAX_THREAD_DEPTH,
      resolveThreadDepth(
        {
          activity_id: event.generated_activity_id,
          parent_activity_id: event.parent_activity_id ?? null,
        },
        byGeneratedId,
      ),
    );
    return { ...event, thread_depth: depth };
  });
}

/** Keep thread members adjacent: root first, then replies oldest → newest. */
export function groupThreadedFeedEvents(events: FeedEvent[]): FeedEvent[] {
  const byId = new Map<string, FeedEvent>();
  const childrenByThread = new Map<string, FeedEvent[]>();
  const roots: FeedEvent[] = [];
  const standalone: FeedEvent[] = [];

  for (const event of events) {
    if (event.generated_activity_id) {
      byId.set(event.generated_activity_id, event);
    }
  }

  for (const event of events) {
    if (!event.thread_id || !event.generated_activity_id) {
      standalone.push(event);
      continue;
    }
    if (event.parent_activity_id) {
      const list = childrenByThread.get(event.thread_id) ?? [];
      list.push(event);
      childrenByThread.set(event.thread_id, list);
      continue;
    }
    if (event.thread_id === event.generated_activity_id) {
      roots.push(event);
      continue;
    }
    standalone.push(event);
  }

  const consumed = new Set<FeedEvent>();
  const grouped: FeedEvent[] = [];

  const emitThread = (root: FeedEvent) => {
    if (consumed.has(root)) return;
    consumed.add(root);
    grouped.push(root);
    const replies = (childrenByThread.get(root.thread_id!) ?? []).sort(
      (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
    );
    for (const reply of replies) {
      if (consumed.has(reply)) continue;
      consumed.add(reply);
      grouped.push(reply);
    }
  };

  for (const event of events) {
    if (event.thread_id && event.generated_activity_id === event.thread_id) {
      emitThread(event);
    }
  }

  for (const event of events) {
    if (!consumed.has(event)) {
      grouped.push(event);
    }
  }

  return grouped.length ? grouped : events;
}

/** Attach parent agent + quote for thread replies. */
export function attachThreadParentContext(events: FeedEvent[]): FeedEvent[] {
  const byId = new Map<string, FeedEvent>();
  for (const event of events) {
    if (event.generated_activity_id) {
      byId.set(event.generated_activity_id, event);
    }
  }
  if (byId.size === 0) return events;

  return events.map((event) => {
    if (!event.parent_activity_id) return event;
    const parent = byId.get(event.parent_activity_id);
    if (!parent) return event;
    const { headline } = resolveAgentFeedCopy(parent);
    const quote = headline.trim() || (parent.body ?? "").trim();
    if (!quote) return event;
    return {
      ...event,
      parent_activity: {
        activity_id: parent.generated_activity_id!,
        agent_name: parent.agent.name,
        agent_slug: parent.agent.slug,
        agent_color: parent.agent.avatar_color,
        quote,
      },
    };
  });
}
