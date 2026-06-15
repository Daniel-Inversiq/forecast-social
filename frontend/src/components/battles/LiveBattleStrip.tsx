"use client";

import Link from "next/link";
import {
  Avatar,
  HeatPill,
  MiniSparkline,
  MoveBadge,
  syntheticMove,
} from "@/components/feed/shared";
import { RankCompactBadge } from "@/components/reputation/RankContextDisplay";
import { buildCredibilityFromBattleAgent } from "@/lib/credibilityScore";
import { getRankContext } from "@/lib/rankContext";
import { battleDetailPath, escalationLabel } from "./battleWarfare";
import type { EnrichedBattle } from "./types";

const STRENGTH_RING: Record<string, string> = {
  legendary: "border-amber-500/35 bg-amber-500/10 text-amber-300",
  heated: "border-rose-500/35 bg-rose-500/10 text-rose-300",
  active: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  emerging: "border-zinc-600/40 bg-zinc-800/60 text-zinc-400",
};

function StripCard({ battle }: { battle: EnrichedBattle }) {
  const move = battle.spread_delta !== 0 ? battle.spread_delta : syntheticMove(battle.contested_market);
  const ring = STRENGTH_RING[battle.battle_strength] ?? STRENGTH_RING.active;
  const rankA = getRankContext({
    slug: battle.agent_a.slug,
    credibilityScore: buildCredibilityFromBattleAgent(battle.agent_a).score,
    niche: battle.agent_a.niche,
    reputationDelta: battle.reputation_delta_a,
  });
  const rankB = getRankContext({
    slug: battle.agent_b.slug,
    credibilityScore: buildCredibilityFromBattleAgent(battle.agent_b).score,
    niche: battle.agent_b.niche,
    reputationDelta: battle.reputation_delta_b,
  });

  return (
    <Link
      href={battleDetailPath(battle)}
      className={`battle-strip-card feed-hover-lift group shrink-0 w-[200px] sm:w-[220px] flex flex-col gap-1.5 p-2.5 rounded-xl border border-zinc-800/80 bg-zinc-950/90 hover:border-rose-500/30 hover:shadow-lg hover:shadow-rose-950/15 relative overflow-hidden ${
        battle.is_live ? "battle-strip-live" : ""
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-rose-500/8 via-transparent to-violet-500/8 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative flex items-center justify-between gap-1">
        <span className={`inline-flex items-center gap-0.5 text-[8px] font-semibold uppercase px-1 py-0.5 rounded-full border ${ring}`}>
          {battle.is_live && <span className="h-1 w-1 rounded-full bg-current feed-live-pill" />}
          {escalationLabel(battle.escalation_state)}
        </span>
        <MoveBadge delta={move} />
      </div>
      <p className="relative text-[11px] font-semibold text-white leading-snug line-clamp-2 min-h-[2.25rem] group-hover:text-rose-100 transition-colors">
        {battle.contested_market}
      </p>
      <div className="relative flex items-center justify-between gap-1">
        <p className="text-lg font-bold tabular-nums text-rose-300/95">
          {Math.round(battle.disagreement_score)}
          <span className="text-[9px] font-normal text-zinc-600 ml-0.5">split</span>
        </p>
        <MiniSparkline seed={battle.id + battle.contested_market} tone="amber" width={44} height={14} />
      </div>
      <div className="relative grid grid-cols-[1fr_auto_1fr] gap-1 items-start">
        <div className="min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-1 min-w-0">
            <Avatar name={battle.agent_a.name} color={battle.agent_a.avatar_color} size="xs" />
            <p className="text-[9px] font-medium text-zinc-300 truncate">{battle.agent_a.name}</p>
          </div>
          <RankCompactBadge rank={rankA} />
        </div>
        <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-wider pt-1">vs</span>
        <div className="min-w-0 flex flex-col gap-0.5 items-end">
          <div className="flex items-center gap-1 min-w-0 justify-end">
            <p className="text-[9px] font-medium text-zinc-300 truncate">{battle.agent_b.name}</p>
            <Avatar name={battle.agent_b.name} color={battle.agent_b.avatar_color} size="xs" />
          </div>
          <RankCompactBadge rank={rankB} />
        </div>
      </div>
      <p className="relative text-[9px] text-zinc-600 truncate">{battle.category}</p>
      <p className="relative text-[9px] text-zinc-600">
        <span className="text-zinc-500">{battle.participants}</span> in conflict
      </p>
    </Link>
  );
}

export function LiveBattleStrip({
  battles,
  loading,
}: {
  battles: EnrichedBattle[];
  loading: boolean;
}) {
  const strip = [...battles]
    .sort((a, b) => b.disagreement_score - a.disagreement_score)
    .slice(0, 12);

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between gap-2 mb-1.5 px-0.5">
        <div className="flex items-center gap-2">
          <HeatPill tone="rose" pulse>
            Live
          </HeatPill>
          <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
            Active clashes
          </span>
          <span className="text-[10px] text-zinc-600 hidden sm:inline">Swipe into a rivalry</span>
        </div>
        <Link href="/markets" className="text-[10px] text-rose-400/90 hover:text-rose-300 shrink-0">
          Split markets →
        </Link>
      </div>
      <div className="relative -mx-0.5">
        <div className="flex gap-2 overflow-x-auto pb-0.5 px-0.5 feed-scroll-x scrollbar-none">
          {loading &&
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 w-[220px] h-[118px] rounded-xl border border-zinc-800/60 bg-zinc-900/40 animate-pulse"
              />
            ))}
          {!loading && strip.map((b) => <StripCard key={b.id} battle={b} />)}
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-zinc-950 via-zinc-950/85 to-transparent"
          aria-hidden
        />
      </div>
    </div>
  );
}
