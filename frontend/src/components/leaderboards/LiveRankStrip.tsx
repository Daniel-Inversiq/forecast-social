"use client";

import Link from "next/link";
import {
  Avatar,
  HeatPill,
  MiniSparkline,
  MomentumIndicator,
  RankMotion,
} from "@/components/feed/shared";
import { ReputationScore } from "@/components/reputation/ReputationScore";
import { ReputationTierBadge } from "@/components/reputation/ReputationTierBadge";
import { buildCredibilityFromRankedAgent } from "@/lib/credibilityScore";
import { momentumLabel } from "./leaderboardEnrichment";
import type { RankedAgent } from "./types";

function StripCard({ agent }: { agent: RankedAgent }) {
  const sparkTone =
    agent.trend === "up" ? "emerald" : agent.trend === "down" ? "amber" : "violet";

  return (
    <Link
      href={`/agents/${agent.slug}`}
      className="leaderboard-strip-card feed-hover-lift group shrink-0 w-[188px] sm:w-[210px] flex flex-col gap-1.5 p-2.5 rounded-xl border border-zinc-800/80 bg-zinc-950/90 hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-950/20 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/8 via-transparent to-amber-500/6 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative flex items-center justify-between gap-1">
        <span className="text-[8px] font-bold text-zinc-600 tabular-nums">#{agent.rank}</span>
        <RankMotion delta={agent.rank_delta} />
      </div>
      <div className="relative flex items-center gap-2">
        <Avatar name={agent.name} color={agent.avatar_color} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-white truncate group-hover:text-violet-100 transition-colors">
            {agent.name}
          </p>
          {agent.tier_key && agent.tier_label && (
            <ReputationTierBadge
              tierKey={agent.tier_key}
              tierLabel={agent.tier_label}
              compact
            />
          )}
          <ReputationScore
            data={buildCredibilityFromRankedAgent(agent)}
            variant="compact"
            className="scale-[0.88] origin-top-left !text-left [&_*]:!text-left [&_p]:!ml-0"
          />
        </div>
      </div>
      <div className="relative flex items-center justify-between gap-1">
        <MomentumIndicator
          direction={agent.trend}
          label={momentumLabel(agent.momentum_state, agent)}
        />
        <MiniSparkline seed={agent.slug + agent.rank} tone={sparkTone} width={48} height={14} />
      </div>
      <div className="relative flex items-center justify-between text-[9px] text-zinc-600">
        <span className="truncate">{agent.niche}</span>
        <span className="tabular-nums shrink-0">{agent.streak}w</span>
      </div>
      <p className="relative text-[9px] text-zinc-500 line-clamp-1 border-t border-zinc-800/60 pt-1">
        {agent.narrative_specialization}
      </p>
    </Link>
  );
}

export function LiveRankStrip({
  agents,
  loading,
}: {
  agents: RankedAgent[];
  loading: boolean;
}) {
  const strip = [...agents]
    .sort((a, b) => {
      const ta = a.trend === "up" ? 2 : a.trend === "down" ? 0 : 1;
      const tb = b.trend === "up" ? 2 : b.trend === "down" ? 0 : 1;
      return tb - ta || b.rank_delta - a.rank_delta;
    })
    .slice(0, 14);

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between gap-2 mb-1.5 px-0.5">
        <div className="flex items-center gap-2">
          <HeatPill tone="violet" pulse>
            Live
          </HeatPill>
          <span className="text-[11px] font-medium text-zinc-400">Rank strip</span>
          <span className="text-[10px] text-zinc-600 hidden sm:inline">
            Credibility in motion · conviction over time
          </span>
        </div>
        <Link href="/reputation" className="text-[10px] text-violet-400/90 hover:text-violet-300 shrink-0">
          Reputation ledger →
        </Link>
      </div>
      <div className="relative -mx-0.5">
        <div className="flex gap-2 overflow-x-auto pb-0.5 px-0.5 feed-scroll-x scrollbar-none">
          {loading &&
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 w-[210px] h-[128px] rounded-xl border border-zinc-800/60 bg-zinc-900/40 animate-pulse"
              />
            ))}
          {!loading && strip.map((a) => <StripCard key={a.slug} agent={a} />)}
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-zinc-950 via-zinc-950/85 to-transparent"
          aria-hidden
        />
      </div>
    </div>
  );
}
