"use client";

import Link from "next/link";
import type { FeedEvent } from "../feedMix";
import { useRelativeTimeTick } from "@/hooks/useRelativeTimeTick";
import { feedDisplayTimestamp } from "@/lib/feedTiming";
import { resolveAgentFeedCopy } from "@/lib/feedAgentCopy";
import { isRivalConversation, resolveReplyTarget } from "@/lib/conversationReply";
import { motionClass } from "../motion";
import { Avatar, formatTimeAgo } from "../shared";
import { GeneratedActivityLinks } from "../GeneratedActivityLinks";

function RivalBadge() {
  return (
    <span className="feed-rival-badge shrink-0" title="Rival exchange">
      Rival
    </span>
  );
}

function AgentNameLink({
  name,
  slug,
  className = "",
}: {
  name: string;
  slug: string;
  className?: string;
}) {
  return (
    <Link
      href={`/agents/${slug}`}
      onClick={(e) => e.stopPropagation()}
      className={`font-semibold scry-text-primary hover:text-violet-200 transition ${className}`}
    >
      {name}
    </Link>
  );
}

export function ConversationReplyFeedCard({
  event,
  index = 0,
  className,
  nested = false,
}: {
  event: FeedEvent;
  index?: number;
  className?: string;
  /** Inside a grouped conversation thread — lighter chrome. */
  nested?: boolean;
}) {
  useRelativeTimeTick();
  const publishedAt = feedDisplayTimestamp(event);
  const target = resolveReplyTarget(event);
  const parentQuote = event.parent_activity?.quote?.trim();
  const { headline, supporting } = resolveAgentFeedCopy(event);
  const replyQuote = supporting ? `${headline} ${supporting}`.trim() : headline;
  const isRival = isRivalConversation(event);
  const isFresh = Boolean(event.show_new || event.is_streamed);
  const battleHref = event.related_battle_slug
    ? `/battles/${event.related_battle_slug}`
    : "/battles";

  return (
    <article
      className={[
        "group relative flex flex-col",
        nested ? "feed-conversation-reply" : "feed-post-card feed-post-card--conversation-reply",
        isRival ? "feed-post-card--conversation-rival" : "",
        isFresh && !nested ? "feed-post-card--fresh" : "",
        motionClass.cardEnterStagger(index),
        className ?? "",
      ].join(" ")}
    >
      <header className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <Link
            href={`/agents/${event.agent.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 rounded-md hover:opacity-90 transition"
          >
            <Avatar name={event.agent.name} color={event.agent.avatar_color} size="sm" />
          </Link>
          <p className="text-[13px] leading-snug min-w-0">
            <AgentNameLink name={event.agent.name} slug={event.agent.slug} />
            <span className="scry-text-secondary font-normal"> replied to </span>
            {target?.slug ? (
              <AgentNameLink name={target.name} slug={target.slug} />
            ) : target ? (
              <span className="font-semibold scry-text-primary">{target.name}</span>
            ) : (
              <span className="scry-text-secondary">thread</span>
            )}
          </p>
          {isRival ? <RivalBadge /> : null}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
          {event.show_new ? (
            <span className="text-[9px] font-semibold text-emerald-400/90">New</span>
          ) : null}
          <span className="text-[10px] scry-text-tertiary tabular-nums">
            {event.show_new ? "now" : formatTimeAgo(publishedAt, true)}
          </span>
        </div>
      </header>

      {parentQuote && target ? (
        <div className="feed-conversation-parent mb-2">
          <span className="feed-conversation-continuation" aria-hidden>
            ↳
          </span>
          <div className="min-w-0">
            <p className="text-[12px] mb-0.5">
              {target.slug ? (
                <AgentNameLink name={target.name} slug={target.slug} className="text-[12px]" />
              ) : (
                <span className="font-semibold scry-text-primary">{target.name}</span>
              )}
              <span className="scry-text-primary">:</span>
            </p>
            <p className="text-[12px] scry-text-secondary leading-relaxed italic">
              &ldquo;{parentQuote}&rdquo;
            </p>
          </div>
        </div>
      ) : null}

      <div className="feed-conversation-reply-body pl-[1.125rem] border-l border-violet-500/25">
        <p className="text-[12px] font-semibold scry-text-primary mb-0.5">
          {event.agent.name}:
        </p>
        <p className="text-[13px] scry-text-primary leading-relaxed">
          &ldquo;{replyQuote}&rdquo;
        </p>
      </div>

      <footer className="flex flex-wrap items-center gap-2 pt-2.5 mt-1 border-t border-zinc-800/35">
        {isRival ? (
          <Link
            href={battleHref}
            className="text-[10px] font-medium text-rose-300/90 hover:text-rose-200 transition"
          >
            View battle →
          </Link>
        ) : null}
        <GeneratedActivityLinks event={event} marketLabel="Follow thread" battleLabel="Public clash" />
      </footer>
    </article>
  );
}
