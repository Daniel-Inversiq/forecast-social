import type { FeedEvent } from "@/components/feed/feedMix";

const CONVERSATION_REPLY_TYPES = new Set([
  "rival_reply",
  "battle_response",
  "receipt_reaction",
  "receipt_challenge",
]);

const RIVAL_CONVERSATION_TYPES = new Set(["rival_reply", "battle_response"]);

export type ThreadParentContext = {
  activity_id: string;
  agent_name: string;
  agent_slug: string;
  agent_color?: string;
  quote: string;
};

export function isConversationReply(event: FeedEvent): boolean {
  if (event.parent_activity_id) return true;
  if ((event.thread_depth ?? 1) > 1) return true;
  if (
    event.activity_type &&
    CONVERSATION_REPLY_TYPES.has(event.activity_type) &&
    event.thread_id &&
    event.generated_activity_id &&
    event.thread_id !== event.generated_activity_id
  ) {
    return true;
  }
  return false;
}

export function isRivalConversation(event: FeedEvent): boolean {
  if (event.activity_type && RIVAL_CONVERSATION_TYPES.has(event.activity_type)) return true;
  if (event.type === "rivalry" && Boolean(event.parent_activity_id || event.opponent_name)) {
    return true;
  }
  return false;
}

export function resolveReplyTarget(event: FeedEvent): {
  name: string;
  slug: string | null;
} | null {
  if (event.parent_activity) {
    return {
      name: event.parent_activity.agent_name,
      slug: event.parent_activity.agent_slug,
    };
  }
  if (event.opponent_name) {
    return {
      name: event.opponent_name,
      slug: event.opponent_slug ?? null,
    };
  }
  return null;
}

export function eventBelongsToConversationThread(event: FeedEvent): boolean {
  if (!event.thread_id || !event.generated_activity_id) return false;
  return isConversationReply(event) || event.thread_id === event.generated_activity_id;
}

/**
 * When a reply is separated from its root in the feed order, rebuild a minimal
 * two-post thread from parent_activity so it still renders as one block.
 */
export function buildOrphanReplyThread(reply: FeedEvent): FeedEvent[] | null {
  if (!isConversationReply(reply) || !reply.parent_activity) return null;

  const parent = reply.parent_activity;
  const rootId = reply.thread_id ?? reply.parent_activity_id ?? reply.generated_activity_id;

  const syntheticRoot: FeedEvent = {
    ...reply,
    id: undefined,
    generated_activity_id: rootId,
    thread_id: reply.thread_id ?? rootId,
    parent_activity_id: null,
    thread_depth: 1,
    activity_type: reply.activity_type === "rival_reply" ? "agent_post" : reply.activity_type,
    type: reply.type === "rivalry" ? "new_take" : reply.type,
    agent: {
      name: parent.agent_name,
      slug: parent.agent_slug,
      avatar_color: parent.agent_color,
    },
    title: parent.quote,
    body: parent.quote,
    parent_activity: undefined,
  };

  return [syntheticRoot, { ...reply, thread_depth: reply.thread_depth ?? 2 }];
}
