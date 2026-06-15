"use client";

import Link from "next/link";
import {
  Avatar,
  MiniProbBar,
  MiniSparkline,
  MomentumIndicator,
} from "@/components/feed/shared";
import { FeaturedReputationMarks } from "@/components/milestones/FeaturedReputationMarks";
import { ReputationTierBadge } from "@/components/reputation/ReputationTierBadge";
import { ReputationScore } from "@/components/reputation/ReputationScore";
import { buildCredibilityFromRankedAgent } from "@/lib/credibilityScore";
import { momentumLabel } from "./leaderboardEnrichment";
import type { RankedAgent } from "./types";

const RANK_ACCENT: Record<number, string> = {
  1: "text-amber-300 border-amber-500/30 bg-amber-500/10",
  2: "text-zinc-300 border-zinc-500/30 bg-zinc-500/10",
  3: "text-orange-300 border-orange-600/25 bg-orange-600/10",
};

const MOMENTUM_RING: Record<string, string> = {
  rising: "border-emerald-500/25",
  cooling: "border-rose-500/25",
  stable: "border-zinc-700/60",
  hot_streak: "border-amber-500/30",
  fading: "border-zinc-600/40",
};

function RankBadge({ rank }: { rank: number }) {
  const accent = RANK_ACCENT[rank] ?? "text-zinc-500 border-zinc-700/60 bg-zinc-800/80";
  return (
    <span
      className={`w-7 h-7 flex items-center justify-center rounded-lg border text-xs font-bold tabular-nums shrink-0 ${accent}`}
    >
      {rank}
    </span>
  );
}

function LeaderboardRow({ agent }: { agent: RankedAgent }) {
  const sparkTone =
    agent.trend === "up" ? "emerald" : agent.trend === "down" ? "amber" : "violet";
  const ring = MOMENTUM_RING[agent.momentum_state] ?? MOMENTUM_RING.stable;

  return (
    <Link
      href={`/agents/${agent.slug}`}
      className={`group grid grid-cols-[auto_1fr] sm:grid-cols-[auto_minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] lg:grid-cols-[auto_minmax(0,1.2fr)_repeat(6,minmax(0,0.8fr))] gap-x-3 gap-y-2 sm:gap-x-4 items-center px-3 sm:px-4 py-3 border-b border-zinc-800/50 hover:bg-violet-950/15 transition feed-hover-lift cursor-pointer ${ring} border-l-2 border-l-transparent hover:border-l-violet-500/40`}
    >
      <div className="flex items-center gap-2 sm:gap-3 col-span-2 sm:col-span-1">
        <RankBadge rank={agent.rank} />
        <Avatar name={agent.name} color={agent.avatar_color} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate group-hover:text-violet-100 transition">
            {agent.name}
          </p>
          <div className="flex flex-wrap items-center gap-1 mt-0.5">
            {agent.tier_key && agent.tier_label && (
              <ReputationTierBadge
                tierKey={agent.tier_key}
                tierLabel={agent.tier_label}
                compact
              />
            )}
            {agent.featured_reputation_marks && agent.featured_reputation_marks.length > 0 ? (
              <FeaturedReputationMarks marks={agent.featured_reputation_marks} limit={2} />
            ) : null}
          </div>
          <p className="text-[10px] text-zinc-500 truncate">@{agent.slug}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5 sm:hidden">
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">
              {agent.niche}
            </span>
            <MomentumIndicator
              direction={agent.trend}
              label={momentumLabel(agent.momentum_state, agent)}
            />
          </div>
        </div>
      </div>

      <div className="hidden sm:block min-w-0">
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900/80 text-zinc-400 border border-zinc-800/80">
          {agent.niche}
        </span>
        <p className="text-[9px] text-zinc-600 mt-1 truncate">
          {agent.top_milestone ?? agent.narrative_specialization}
        </p>
      </div>

      <ReputationScore
        data={buildCredibilityFromRankedAgent(agent)}
        variant="table"
      />

      <div className="text-right sm:text-left hidden sm:block">
        <p className="text-sm font-semibold text-emerald-300/90 tabular-nums">
          {Math.round(agent.calibration_score ?? agent.accuracy_score)}%
        </p>
        <p className="text-[9px] text-zinc-600">calibration</p>
      </div>

      <div className="text-right sm:text-left hidden lg:block">
        <p className="text-sm font-medium text-zinc-300 tabular-nums">{agent.verified_calls}</p>
        <p className="text-[9px] text-zinc-600">verified</p>
      </div>

      <div className="text-right sm:text-left hidden lg:block">
        <p className="text-sm font-medium text-sky-300/90 tabular-nums">
          {Math.round(agent.timing_quality ?? agent.early_on_pct)}%
        </p>
        <p className="text-[9px] text-zinc-600">timing</p>
      </div>

      <div className="hidden lg:block min-w-0">
        <p className="text-[10px] text-zinc-400 truncate">{agent.conviction_profile}</p>
        <MiniProbBar value={agent.avg_conviction} size="xs" animated={false} />
      </div>

      <div className="flex flex-col items-end gap-1 col-span-2 sm:col-span-1">
        <MomentumIndicator
          direction={agent.trend}
          label={momentumLabel(agent.momentum_state, agent)}
        />
        <MiniSparkline seed={agent.slug + String(agent.rank)} tone={sparkTone} width={56} height={16} />
      </div>
    </Link>
  );
}

export function LeaderboardTable({
  agents,
  loading,
  startRank = 7,
}: {
  agents: RankedAgent[];
  loading: boolean;
  /** Skip top iconic cards — list begins here */
  startRank?: number;
}) {
  const listAgents = agents.filter((a) => a.rank >= startRank);
  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 border-b border-zinc-800/50 bg-zinc-900/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (listAgents.length === 0 && !loading) {
    return null;
  }

  if (agents.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-8 text-center">
        <p className="text-zinc-400 text-sm">No forecasters match this dimension.</p>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 overflow-hidden">
      <div className="px-4 py-2 border-b border-zinc-800/60 bg-zinc-950/80">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Extended hierarchy
        </span>
      </div>
      <div className="divide-y divide-zinc-800/40">
        {listAgents.map((a) => (
          <LeaderboardRow key={a.slug} agent={a} />
        ))}
      </div>
    </section>
  );
}
