import type { FeedStreamItem } from "@/components/feed/arcThreadGroups";
import type { FeedEvent } from "@/components/feed/feedMix";
import { eventBelongsToConversationThread } from "@/lib/conversationReply";
import { feedLoadLog } from "@/lib/feedLoadLog";

export type ConversationDisplayItem =
  | { kind: "single"; item: FeedStreamItem; renderKey: string }
  | { kind: "thread"; threadId: string; items: FeedStreamItem[]; renderKey: string };

/** Stable id for a stream row — prefer generated activity id, then feed event id. */
export function streamItemStableId(item: FeedStreamItem): string {
  if (item.type === "arc_header") {
    return `arc-${item.clusterKey}`;
  }
  const event = item.event;
  if (event.generated_activity_id) {
    return `gen-${event.generated_activity_id}`;
  }
  if (event.id != null) {
    return `id-${event.id}`;
  }
  return `evt-${event.agent.slug}-${event.created_at}-${item.index}`;
}

/**
 * Unique React key for a grouped conversation block.
 * threadId alone is not sufficient — the same thread can appear in multiple
 * non-adjacent segments after merge/sort.
 */
export function buildConversationRenderKey(
  kind: ConversationDisplayItem["kind"],
  opts: {
    threadId?: string;
    items?: FeedStreamItem[];
    item?: FeedStreamItem;
    /** Position in the grouped result — disambiguates repeated threadIds. */
    sequence: number;
  },
): string {
  if (kind === "single" && opts.item) {
    return `single-${streamItemStableId(opts.item)}-${opts.sequence}`;
  }
  if (kind === "thread" && opts.threadId && opts.items?.length) {
    const anchor = streamItemStableId(opts.items[0]!);
    const tail =
      opts.items.length > 1
        ? streamItemStableId(opts.items[opts.items.length - 1]!)
        : anchor;
    return `thread-${opts.threadId}-${anchor}-${tail}-${opts.sequence}`;
  }
  return `group-${opts.sequence}`;
}

export function conversationRenderKeys(groups: ConversationDisplayItem[]): string[] {
  return groups.map((g) => g.renderKey);
}

export function conversationRenderKeysAreUnique(groups: ConversationDisplayItem[]): boolean {
  const keys = conversationRenderKeys(groups);
  return keys.length === new Set(keys).size;
}

export function groupConversationDisplayItems(
  streamItems: FeedStreamItem[],
): ConversationDisplayItem[] {
  feedLoadLog("groupConversationDisplayItems start", { streamItems: streamItems.length });
  const result: ConversationDisplayItem[] = [];
  let index = 0;

  const pushSingle = (item: FeedStreamItem) => {
    const sequence = result.length;
    result.push({
      kind: "single",
      item,
      renderKey: buildConversationRenderKey("single", { item, sequence }),
    });
  };

  const pushThread = (threadId: string, batch: FeedStreamItem[]) => {
    const sequence = result.length;
    result.push({
      kind: "thread",
      threadId,
      items: batch,
      renderKey: buildConversationRenderKey("thread", {
        threadId,
        items: batch,
        sequence,
      }),
    });
  };

  while (index < streamItems.length) {
    const current = streamItems[index];
    if (current.type !== "event" || !eventBelongsToConversationThread(current.event)) {
      pushSingle(current);
      index += 1;
      continue;
    }

    const threadId = current.event.thread_id!;
    const batch: FeedStreamItem[] = [];
    while (index < streamItems.length) {
      const item = streamItems[index];
      if (item.type !== "event" || item.event.thread_id !== threadId) break;
      batch.push(item);
      index += 1;
    }

    const hasReply = batch.some(
      (item) =>
        item.type === "event" &&
        item.event.parent_activity_id != null &&
        item.event.generated_activity_id !== item.event.thread_id,
    );

    if (batch.length > 1 || hasReply) {
      pushThread(threadId, batch);
    } else {
      for (const item of batch) {
        pushSingle(item);
      }
    }
  }

  feedLoadLog("groupConversationDisplayItems done", {
    groups: result.length,
    threads: result.filter((g) => g.kind === "thread").length,
  });
  return result;
}

/** Test helper — build minimal generated-activity stream rows. */
export function mockConversationStreamEvent(
  partial: Partial<FeedEvent> & Pick<FeedEvent, "generated_activity_id">,
  index: number,
): FeedStreamItem {
  return {
    type: "event",
    index,
    event: {
      id: partial.id ?? -(index + 1),
      type: partial.type ?? "rivalry",
      agent: partial.agent ?? { name: "Agent", slug: "agent", avatar_color: "#000" },
      title: partial.title ?? "Title",
      body: partial.body ?? "Body",
      probability: partial.probability ?? null,
      confidence: partial.confidence ?? null,
      created_at: partial.created_at ?? "2026-01-01T00:00:00Z",
      thread_id: partial.thread_id ?? partial.generated_activity_id,
      parent_activity_id: partial.parent_activity_id ?? null,
      generated_activity_id: partial.generated_activity_id,
      activity_type: partial.activity_type ?? "rival_reply",
      ...partial,
    },
  };
}
