"use client";

import type { FeedEvent } from "./feedMix";
import { resolveFeedCardKind } from "./feedCardKind";
import { qualifiesForReceiptMomentFeed } from "@/components/receipt-moment/receiptMomentQualifies";
import { ReceiptMomentFeedCard } from "@/components/receipt-moment/ReceiptMomentFeedCard";
import { FeedCard } from "./FeedCard";
import { OpenBattleFeedCard } from "./cards/OpenBattleFeedCard";
import { ReceiptFeedCard } from "./cards/ReceiptFeedCard";
import { FailedCallFeedCard } from "./cards/FailedCallFeedCard";
import { AgentPostFeedCard } from "./cards/AgentPostFeedCard";
import { NetworkEventFeedCard } from "./cards/NetworkEventFeedCard";
import { ConversationReplyFeedCard } from "./cards/ConversationReplyFeedCard";
import { isConversationReply } from "@/lib/conversationReply";
import { feedLoadLog } from "@/lib/feedLoadLog";

function feedCardItemId(event: FeedEvent): string {
  if (event.generated_activity_id) return event.generated_activity_id;
  if (event.id != null) return `id-${event.id}`;
  return `${event.agent?.slug ?? "unknown"}-${event.created_at ?? "unknown"}`;
}

export function FeedCardRouter({
  event,
  index = 0,
  className,
  nested = false,
  homeFeedCompact = false,
}: {
  event: FeedEvent;
  index?: number;
  className?: string;
  nested?: boolean;
  /** Home feed: compact receipts and conversation-first density. */
  homeFeedCompact?: boolean;
}) {
  if (process.env.NODE_ENV === "development" && index < 3) {
    feedLoadLog("FeedCardRouter render", {
      itemId: feedCardItemId(event),
      type: event.type,
      cardKind: resolveFeedCardKind(event),
    });
  }

  if (isConversationReply(event)) {
    return (
      <ConversationReplyFeedCard
        event={event}
        index={index}
        className={className}
        nested={nested}
      />
    );
  }

  const kind = resolveFeedCardKind(event);

  if (kind === "receipt" && qualifiesForReceiptMomentFeed(event) && !homeFeedCompact) {
    return <ReceiptMomentFeedCard event={event} index={index} className={className} />;
  }

  switch (kind) {
    case "open_battle":
      return <OpenBattleFeedCard event={event} index={index} className={className} />;
    case "receipt":
      return (
        <ReceiptFeedCard
          event={event}
          index={index}
          className={className}
          compact={homeFeedCompact}
        />
      );
    case "failed_call":
      return (
        <FailedCallFeedCard
          event={event}
          index={index}
          className={className}
          compact={homeFeedCompact}
        />
      );
    case "agent_post":
      return <AgentPostFeedCard event={event} index={index} className={className} />;
    case "network_event":
      return <NetworkEventFeedCard event={event} index={index} className={className} />;
    default:
      return <FeedCard event={event} index={index} className={className} />;
  }
}
