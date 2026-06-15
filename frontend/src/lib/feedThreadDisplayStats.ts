import type { FeedStreamItem } from "@/components/feed/arcThreadGroups";
import type { FeedEvent } from "@/components/feed/feedMix";
import { buildFeedStreamItems } from "@/components/feed/arcThreadGroups";
import { orderFeedForDisplay } from "@/components/feed/feedMix";
import {
  groupConversationDisplayItems,
  type ConversationDisplayItem,
} from "@/lib/conversationThreadGroups";
import { eventBelongsToConversationThread, isConversationReply } from "@/lib/conversationReply";
import {
  countVisibleThreadLabels,
  resolveThreadBlockLabel,
  type ThreadBlockLabel,
} from "@/lib/threadBlockLabel";

export type FeedThreadDisplayStats = {
  thread_blocks_rendered_ui: number;
  standalone_thread_candidates: number;
  visible_thread_label_counts: Record<ThreadBlockLabel, number>;
};

function isStandaloneThreadCandidate(event: FeedEvent): boolean {
  if (!event.generated_activity_id && !event.thread_id) return false;
  return (
    eventBelongsToConversationThread(event) ||
    isConversationReply(event) ||
    Boolean(event.parent_activity_id)
  );
}

function threadEventsFromGroup(group: ConversationDisplayItem): FeedEvent[] {
  if (group.kind !== "thread") return [];
  return group.items
    .filter((item): item is Extract<typeof item, { type: "event" }> => item.type === "event")
    .map((item) => item.event);
}

/** Count UI thread blocks vs thread-capable rows that still render as singles. */
export function computeFeedThreadDisplayStats(
  groups: ConversationDisplayItem[],
): FeedThreadDisplayStats {
  let thread_blocks_rendered_ui = 0;
  let standalone_thread_candidates = 0;
  const visibleLabels: ThreadBlockLabel[] = [];

  for (const group of groups) {
    if (group.kind === "thread") {
      thread_blocks_rendered_ui += 1;
      visibleLabels.push(resolveThreadBlockLabel(threadEventsFromGroup(group)));
      continue;
    }
    if (group.item.type === "event" && isStandaloneThreadCandidate(group.item.event)) {
      standalone_thread_candidates += 1;
    }
  }

  return {
    thread_blocks_rendered_ui,
    standalone_thread_candidates,
    visible_thread_label_counts: countVisibleThreadLabels(visibleLabels),
  };
}

/** Run the Latest-mode display pipeline and return grouping stats. */
export function computeLatestFeedThreadDisplayStats(
  events: FeedEvent[],
  options?: { homeFeed?: boolean; activeStoryKeys?: string[] },
): FeedThreadDisplayStats & { groups: ConversationDisplayItem[] } {
  const displayed = orderFeedForDisplay(events, "Latest", Date.now(), {
    homeFeed: options?.homeFeed ?? false,
  });
  const streamItems: FeedStreamItem[] = buildFeedStreamItems(
    displayed,
    options?.activeStoryKeys,
    { skipArcHeaders: options?.homeFeed ?? false },
  );
  const groups = groupConversationDisplayItems(streamItems);
  return { ...computeFeedThreadDisplayStats(groups), groups };
}
