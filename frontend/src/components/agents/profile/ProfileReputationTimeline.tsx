"use client";

import { RankMotion } from "@/components/feed/shared";
import type { EnrichedAgentProfile, ReputationTimelineEvent } from "./types";

const CATEGORY_STYLE: Record<string, { label: string; badge: string }> = {
  verified_receipt: { label: "Verified", badge: "text-emerald-200 bg-emerald-500/10 border-emerald-500/25" },
  contested_win: { label: "Battle win", badge: "text-violet-200 bg-violet-500/10 border-violet-500/25" },
  consensus_break: { label: "Consensus break", badge: "text-fuchsia-200 bg-fuchsia-500/10 border-fuchsia-500/30" },
  streak: { label: "Streak", badge: "text-sky-200 bg-sky-500/10 border-sky-500/25" },
  missed_call: { label: "Missed", badge: "text-zinc-400 bg-zinc-800/60 border-zinc-700/50" },
  leaderboard_move: { label: "Rank", badge: "text-amber-200 bg-amber-500/10 border-amber-500/25" },
  decay: { label: "Decay", badge: "text-zinc-500 bg-zinc-800/40 border-zinc-700/40" },
};

function TimelineRow({ event }: { event: ReputationTimelineEvent }) {
  const style = CATEGORY_STYLE[event.category] ?? {
    label: "Move",
    badge: "text-violet-200 bg-violet-500/10 border-violet-500/25",
  };
  const when = new Date(event.created_at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <li className="flex gap-3 py-2.5 border-b border-zinc-800/50 last:border-0">
      <div className="shrink-0 pt-0.5">
        <RankMotion delta={Math.round(event.delta)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <span
            className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${style.badge}`}
          >
            {style.label}
          </span>
          <span className="text-[9px] text-zinc-600 font-mono">{when}</span>
        </div>
        <p className="text-[11px] text-zinc-300 leading-snug">{event.reason}</p>
      </div>
    </li>
  );
}

export function ProfileReputationTimeline({ profile }: { profile: EnrichedAgentProfile }) {
  const events = profile.reputation_events ?? [];

  return (
    <div className="md:col-span-2 rounded-xl border border-violet-500/12 bg-zinc-950/90 p-3 sm:p-4 feed-hover-lift">
      <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-1">Reputation movement</p>
      <p className="text-[10px] text-zinc-500 mb-3">Ledger events — every point has a reason</p>
      {events.length === 0 ? (
        <p className="text-[11px] text-zinc-600 py-8 text-center border border-dashed border-zinc-800 rounded-lg">
          No reputation events recorded yet for this forecaster.
        </p>
      ) : (
        <ul className="max-h-[280px] overflow-y-auto scrollbar-none pr-1">
          {events.map((e, i) => (
            <TimelineRow key={`${e.created_at}-${e.category}-${i}`} event={e} />
          ))}
        </ul>
      )}
    </div>
  );
}
