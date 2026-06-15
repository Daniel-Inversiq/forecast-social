"use client";



import Link from "next/link";

import type { ReactNode } from "react";

import { useRelativeTimeTick } from "@/hooks/useRelativeTimeTick";

import type { FeedEvent } from "../feedMix";

import { MAX_THREAD_DEPTH } from "@/lib/threadConstants";
import { feedCardKindLabel, type FeedCardKind } from "../feedCardKind";
import {
  resolveActivityTypeSurface,
  resolveActivityTypeTone,
} from "../generatedActivityStyle";
import { resolveAgentFeedSubtitle } from "@/lib/feedAgentCopy";

import { motionClass } from "../motion";

import { feedDisplayTimestamp } from "@/lib/feedTiming";

import { Avatar, formatTimeAgo } from "../shared";



const KIND_SURFACE: Record<FeedCardKind, string> = {

  open_battle: "feed-post-card feed-post-card--battle",

  receipt: "feed-post-card feed-post-card--receipt feed-post-card--feature",

  failed_call: "feed-post-card feed-post-card--failed feed-post-card--feature",

  agent_post: "feed-post-card feed-post-card--agent",

  network_event: "feed-post-card feed-post-card--network feed-post-card--feature",

};



const KIND_LABEL: Record<FeedCardKind, string> = {

  open_battle: "text-rose-400/80",

  receipt: "text-emerald-400/80",

  failed_call: "text-zinc-400",

  agent_post: "text-violet-400/70",

  network_event: "text-amber-400/75",

};



export function FeedCardFrame({

  event,

  kind,

  index = 0,

  className,

  children,

  footer,

  contained = true,

  compact = false,

}: {

  event: FeedEvent;

  kind: FeedCardKind;

  index?: number;

  className?: string;

  children: ReactNode;

  footer?: ReactNode;

  /** Home feed uses contained cards; legacy surfaces may use stream dividers. */

  contained?: boolean;

  /** Home feed: skip feature-card sizing for receipts and network events. */

  compact?: boolean;

}) {

  useRelativeTimeTick();

  const publishedAt = feedDisplayTimestamp(event);

  const agentSubtitle = resolveAgentFeedSubtitle(event);
  const activityTone = resolveActivityTypeTone(event);
  const activitySurface = resolveActivityTypeSurface(event);
  const labelTone = activityTone ?? KIND_LABEL[kind];
  const featureKinds = new Set<FeedCardKind>(["receipt", "failed_call", "network_event"]);
  const surface = [
    KIND_SURFACE[kind].replace(
      compact && featureKinds.has(kind) ? " feed-post-card--feature" : "",
      "",
    ),
    activitySurface,
  ]
    .filter(Boolean)
    .join(" ");
  const headerSubtitle =
    agentSubtitle ?? (event.is_generated_activity ? null : feedCardKindLabel(kind, event));

  const isFresh = Boolean(event.show_new || event.is_streamed);
  const threadDepth = Math.min(MAX_THREAD_DEPTH, event.thread_depth ?? 1);
  const isThreadReply = threadDepth > 1;



  return (

    <article

      className={[

        "group relative flex flex-col feed-post-stream",

        contained ? surface : "py-4 sm:py-5 border-l-2 border-l-zinc-800/60",

        isThreadReply ? "feed-post-card--thread-reply border-l-violet-500/35" : "",

        isThreadReply && threadDepth === 2 ? "ml-3 sm:ml-4" : "",

        isThreadReply && threadDepth >= 3 ? "ml-5 sm:ml-7" : "",

        isFresh && contained ? "feed-post-card--fresh" : "",

        isFresh && !contained ? "feed-post-stream--fresh" : "",

        motionClass.cardEnterStagger(index),

        className ?? "",

      ].join(" ")}

    >

      <header className="flex items-start justify-between gap-3 mb-2.5">

        <div className="flex items-center gap-2.5 min-w-0">

          <Link

            href={`/agents/${event.agent.slug}`}

            onClick={(e) => e.stopPropagation()}

            className="flex items-center gap-2.5 min-w-0 rounded-md hover:opacity-90 transition"

          >

            <Avatar name={event.agent.name} color={event.agent.avatar_color} size="sm" />

            <div className="min-w-0">

              <p className="text-[14px] font-semibold scry-text-primary truncate leading-tight">

                {event.agent.name}

              </p>

              {isThreadReply ? (
                <p className="text-[10px] font-medium text-violet-300/55 truncate">
                  {event.opponent_name ? `Replying to ${event.opponent_name}` : "In thread"}
                </p>
              ) : headerSubtitle ? (
                <p className={`text-[10px] font-medium ${labelTone} truncate`}>
                  {headerSubtitle}
                </p>
              ) : null}

            </div>

          </Link>

        </div>

        <div className="flex items-center gap-2 shrink-0 pt-0.5">

          {process.env.NODE_ENV === "development" && event.narrative_stage_label ? (
            <span className="text-[9px] font-medium text-violet-300/50 tabular-nums">
              {event.narrative_stage_label}
            </span>
          ) : null}

          {event.show_new && (

            <span className="text-[9px] font-semibold text-emerald-400/90">New</span>

          )}

          <span className="text-[10px] scry-text-tertiary tabular-nums">

            {event.show_new ? "now" : formatTimeAgo(publishedAt, true)}

          </span>

        </div>

      </header>



      <div className="space-y-2 flex-1 flex flex-col min-w-0 max-w-[52rem]">{children}</div>



      {footer ? <footer className="pt-2.5 mt-1 border-t border-zinc-800/40">{footer}</footer> : null}



      {!contained && <div className="absolute left-0 right-0 bottom-0 h-px bg-zinc-800/50" aria-hidden />}

    </article>

  );

}


