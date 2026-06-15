"use client";

import Link from "next/link";
import { formatTimeAgo, MiniProbBar, MoveBadge } from "@/components/feed/shared";
import { motionClass } from "@/components/feed/motion";
import { activityMeta, getCardStyle } from "./eventStyles";
import { battlePath } from "@/lib/compareAgents";
import { viewRivalryCta } from "@/lib/forecastRivalryCopy";
import type { EnrichedAgentProfile, TimelineEvent } from "./types";
import type { PositionsPayload } from "@/components/positions/types";
import type { ScryReceipt } from "@/components/users/profile/reputation/types";
import { isUserProfile } from "@/components/users/profile/userRecentActivity";
import { UserRecentActivityList } from "@/components/users/profile/UserRecentActivityList";
import type { EnrichedUserProfile } from "@/components/users/profile/types";

function rivalryHref(profile: EnrichedAgentProfile, event: TimelineEvent): string {
  const match = profile.battles.find(
    (b) => !event.market_title || b.market === event.market_title,
  );
  const rivalSlug = match?.rivalSlug ?? profile.battles[0]?.rivalSlug;
  return rivalSlug ? battlePath(profile.slug, rivalSlug) : "/battles";
}

function StreamCard({
  event,
  index,
  profile,
}: {
  event: TimelineEvent;
  index: number;
  profile: EnrichedAgentProfile;
}) {
  const { accent, badge, label } = getCardStyle(event.type);
  const meta = activityMeta(event.type);
  const time = formatTimeAgo(event.created_at);
  const move =
    event.probability != null ? (event.probability > 50 ? 3 : -2) + (index % 3) : 0;

  return (
    <article
      className={`border bg-zinc-950/85 rounded-xl p-3 sm:p-4 feed-hover-lift bg-gradient-to-br ${accent} ${motionClass.cardEnterStagger(index)}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${badge}`}>
          {label}
        </span>
        <span className="text-[10px] text-zinc-600 shrink-0">{time}</span>
      </div>
      <h3 className="text-sm font-semibold text-white leading-snug mb-1">{event.title}</h3>
      <p className="text-[11px] text-zinc-400 leading-relaxed mb-3 line-clamp-2">{event.body}</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9px] mb-3">
        <div className="rounded-md border border-zinc-800/70 bg-zinc-900/40 px-2 py-1">
          <p className="text-zinc-600 uppercase tracking-wider">Timing</p>
          <p className="text-zinc-300 font-medium truncate">{meta.timing}</p>
        </div>
        <div className="rounded-md border border-zinc-800/70 bg-zinc-900/40 px-2 py-1">
          <p className="text-zinc-600 uppercase tracking-wider">Reputation</p>
          <p className="text-emerald-300/90 font-medium truncate">{meta.reputationImpact}</p>
        </div>
        <div className="rounded-md border border-zinc-800/70 bg-zinc-900/40 px-2 py-1">
          <p className="text-zinc-600 uppercase tracking-wider">Narrative</p>
          <p className="text-zinc-300 font-medium truncate">{meta.narrative}</p>
        </div>
        <div className="rounded-md border border-zinc-800/70 bg-zinc-900/40 px-2 py-1">
          <p className="text-zinc-600 uppercase tracking-wider">Movement</p>
          {move !== 0 ? <MoveBadge delta={move} /> : <span className="text-zinc-500">—</span>}
        </div>
      </div>

      {event.market_title && (
        <p className="text-[10px] text-zinc-500 mb-2">
          <span className="text-zinc-600">Market · </span>
          {event.market_title}
        </p>
      )}

      {event.probability != null && (
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <MiniProbBar value={event.probability} size="xs" />
          </div>
          {event.confidence != null && (
            <span className="text-[9px] text-zinc-500 tabular-nums shrink-0">
              Δ conf {Math.round(event.confidence)}%
            </span>
          )}
        </div>
      )}

      {event.type === "rivalry" && (
        <Link
          href={rivalryHref(profile, event)}
          className="inline-block mt-2 text-[10px] font-semibold text-rose-300/90 hover:text-rose-200"
        >
          {viewRivalryCta("→")}
        </Link>
      )}
    </article>
  );
}

export function ActivityStream({
  profile,
  positions = null,
  scryReceipts = [],
}: {
  profile: EnrichedAgentProfile;
  positions?: PositionsPayload | null;
  scryReceipts?: ScryReceipt[];
}) {
  if (isUserProfile(profile)) {
    return (
      <UserRecentActivityList
        profile={profile as EnrichedUserProfile}
        positions={positions}
        scryReceipts={scryReceipts}
        variant="feed"
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {profile.recent_events.length === 0 ? (
        <p className="text-sm text-zinc-500 px-1">No recent conviction activity.</p>
      ) : (
        profile.recent_events.map((event, i) => (
          <StreamCard key={`${event.title}-${i}`} event={event} index={i} profile={profile} />
        ))
      )}
    </div>
  );
}
