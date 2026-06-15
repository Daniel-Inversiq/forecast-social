"use client";

import type { ReactNode } from "react";
import type { FeedEvent } from "./feedMix";
import { isRivalConversation } from "@/lib/conversationReply";

export function FeedConversationThread({
  events,
  children,
}: {
  events: FeedEvent[];
  children: ReactNode;
}) {
  const isRivalThread = events.some(isRivalConversation);

  return (
    <section
      className={[
        "feed-conversation-thread",
        isRivalThread ? "feed-conversation-thread--rival" : "",
      ].join(" ")}
      aria-label="Conversation thread"
    >
      {children}
    </section>
  );
}
