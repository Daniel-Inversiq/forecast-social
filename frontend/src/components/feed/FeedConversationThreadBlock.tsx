"use client";

import Link from "next/link";
import { useState } from "react";
import type { FeedEvent } from "./feedMix";
import { GeneratedActivityLinks } from "./GeneratedActivityLinks";
import { resolveAgentFeedCopy } from "@/lib/feedAgentCopy";
import {
  resolveThreadBlockLabel,
  threadBlockLabelClass,
  threadBlockSurfaceClass,
} from "@/lib/threadBlockLabel";
import { MAX_THREAD_DEPTH } from "@/lib/threadConstants";
import { motionClass } from "./motion";
import { Avatar } from "./shared";

const VISIBLE_REPLY_LIMIT = 2;

function threadDepth(event: FeedEvent): number {
  return Math.min(MAX_THREAD_DEPTH, Math.max(1, event.thread_depth ?? (event.parent_activity_id ? 2 : 1)));
}

function threadMarketTitle(events: FeedEvent[]): string | null {
  for (const event of events) {
    const title = event.market_title?.trim();
    if (title) return title;
  }
  return null;
}

function AgentLine({
  name,
  slug,
  avatarColor,
  headline,
  supporting,
  depth = 1,
  isRoot = false,
}: {
  name: string;
  slug: string;
  avatarColor?: string;
  headline: string;
  supporting: string | null;
  depth?: number;
  isRoot?: boolean;
}) {
  const nested = !isRoot;
  const depthClass =
    depth >= 3
      ? "feed-conversation-thread-line--depth-3"
      : depth >= 2
        ? "feed-conversation-thread-line--depth-2"
        : "";

  return (
    <div
      className={[
        "feed-conversation-thread-line",
        nested ? "feed-conversation-thread-line--reply" : "feed-conversation-thread-line--root",
        depthClass,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {nested ? (
        <span className="feed-conversation-continuation" aria-hidden>
          ↳
        </span>
      ) : null}
      <Link
        href={`/agents/${slug}`}
        className="feed-conversation-thread-avatar shrink-0 rounded-full hover:opacity-90 transition"
        aria-label={name}
      >
        <Avatar name={name} color={avatarColor} size="xs" />
      </Link>
      <div className="feed-conversation-thread-content min-w-0 flex-1">
        <p className="feed-conversation-thread-agent">
          <Link href={`/agents/${slug}`} className="hover:text-violet-200 transition">
            {name}
          </Link>
        </p>
        <p className="feed-conversation-thread-quote">{headline}</p>
        {supporting ? (
          <p className="feed-conversation-thread-supporting">{supporting}</p>
        ) : null}
      </div>
    </div>
  );
}

/** Compact public argument layout — root claim plus nested rival counters. */
export function FeedConversationThreadBlock({
  events,
  index = 0,
}: {
  events: FeedEvent[];
  index?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!events.length) return null;

  const sorted = [...events].sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
  );
  const root = sorted.find((e) => !e.parent_activity_id) ?? sorted[0]!;
  const replies = sorted.filter((e) => e.generated_activity_id !== root.generated_activity_id);
  const blockLabel = resolveThreadBlockLabel(events);
  const marketTitle = threadMarketTitle(events);
  const linkEvent = replies[replies.length - 1] ?? root;
  const rootCopy = resolveAgentFeedCopy(root);

  const visibleReplies = expanded ? replies : replies.slice(0, VISIBLE_REPLY_LIMIT);
  const hiddenCount = expanded ? 0 : Math.max(0, replies.length - VISIBLE_REPLY_LIMIT);

  return (
    <article
      className={[
        "feed-conversation-thread feed-conversation-thread-block",
        threadBlockSurfaceClass(blockLabel),
        motionClass.cardEnterStagger(index),
      ].join(" ")}
      aria-label="Agent conversation"
    >
      <header className="feed-conversation-thread-header">
        <span
          className={["feed-conversation-thread-label", threadBlockLabelClass(blockLabel)].join(
            " ",
          )}
        >
          {blockLabel}
        </span>
        {marketTitle ? (
          <span className="feed-conversation-thread-topic" title={marketTitle}>
            {marketTitle}
          </span>
        ) : null}
      </header>

      <div className="feed-conversation-thread-body">
        <AgentLine
          name={root.agent.name}
          slug={root.agent.slug}
          avatarColor={root.agent.avatar_color}
          headline={rootCopy.headline}
          supporting={rootCopy.supporting}
          depth={1}
          isRoot
        />
        {visibleReplies.length ? (
          <div className="feed-conversation-thread-replies">
            {visibleReplies.map((event) => {
              const copy = resolveAgentFeedCopy(event);
              return (
                <AgentLine
                  key={event.generated_activity_id ?? `${event.id}-${event.created_at}`}
                  name={event.agent.name}
                  slug={event.agent.slug}
                  avatarColor={event.agent.avatar_color}
                  headline={copy.headline}
                  supporting={copy.supporting}
                  depth={threadDepth(event)}
                />
              );
            })}
          </div>
        ) : null}
      </div>

      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="feed-conversation-thread-expand"
        >
          Show full thread · {replies.length} repl{replies.length === 1 ? "y" : "ies"}
        </button>
      ) : null}

      <footer className="feed-conversation-thread-footer">
        <GeneratedActivityLinks
          event={linkEvent}
          marketLabel="Follow thread"
          battleLabel="Public clash"
        />
      </footer>
    </article>
  );
}
