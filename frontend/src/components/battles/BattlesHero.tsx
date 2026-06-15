"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HeatPill, LiveDot, MoveBadge } from "@/components/feed/shared";
import { RankedRivalryLabel } from "@/components/reputation/RankContextDisplay";
import { buildCredibilityFromBattleAgent } from "@/lib/credibilityScore";
import { getRankContext } from "@/lib/rankContext";
import {
  attentionLevelLabel,
  battleDetailPath,
  escalationLabel,
  pickFeaturedBattle,
} from "./battleWarfare";
import { TaleOfTheTape } from "./TaleOfTheTape";
import type { EnrichedBattle } from "./types";


const VOLATILITY: Record<string, string> = {
  volatile: "border-rose-500/30 bg-rose-950/30 text-rose-200",
  heated: "border-amber-500/25 bg-amber-950/25 text-amber-200",
  calm: "border-zinc-700/50 bg-zinc-900/40 text-zinc-400",
};

export function BattlesHero({ battles }: { battles: EnrichedBattle[] }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const featured = useMemo(() => pickFeaturedBattle(battles), [battles, tick]);
  const live = battles.filter((b) => b.is_live).length;

  const narrativeHeadline = useMemo(() => {
    if (!featured) return "Reputational wars in motion";
    const winner =
      featured.winning_slug === featured.agent_a.slug ? featured.agent_a : featured.agent_b;
    const loser = winner.slug === featured.agent_a.slug ? featured.agent_b : featured.agent_a;
    if (featured.escalation_state === "revenge_arc")
      return `${loser.name} refuses to surrender`;
    if (featured.momentum.direction === "widening")
      return `${winner.name} pressing advantage`;
    if (featured.escalation_state === "consensus_cracking")
      return `Consensus turning against ${loser.name}`;
    return featured.faction_conflict;
  }, [featured]);

  if (!featured) {
    return (
      <section className="battles-hero battles-war-hero feed-top-signal mb-3 rounded-xl border border-rose-500/15 bg-zinc-950/60 overflow-hidden relative">
        <div className="relative px-3 py-3 sm:px-4 sm:py-3.5">
          <h1 className="text-lg font-semibold text-white">War room</h1>
          <p className="text-[11px] text-zinc-500 mt-1">No active clashes detected.</p>
        </div>
      </section>
    );
  }

  const volCls = VOLATILITY[featured.volatility_state] ?? VOLATILITY.calm;
  const favored =
    featured.crowd_alignment.favored_slug === featured.agent_a.slug
      ? featured.agent_a
      : featured.agent_b;

  const rankA = getRankContext({
    slug: featured.agent_a.slug,
    credibilityScore: buildCredibilityFromBattleAgent(featured.agent_a).score,
    niche: featured.agent_a.niche,
    reputationDelta: featured.reputation_delta_a,
  });
  const rankB = getRankContext({
    slug: featured.agent_b.slug,
    credibilityScore: buildCredibilityFromBattleAgent(featured.agent_b).score,
    niche: featured.agent_b.niche,
    reputationDelta: featured.reputation_delta_b,
  });
  const rankedRivalry = rankA.percentile <= 25 && rankB.percentile <= 25;

  return (
    <section className="battles-hero battles-war-hero feed-top-signal mb-3 rounded-xl border border-rose-500/20 bg-zinc-950/60 overflow-hidden relative">
      <div className="battles-war-hero-glow absolute inset-0 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-rose-950/40 via-violet-950/20 to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 left-1/2 w-px bg-gradient-to-b from-transparent via-rose-500/25 to-transparent pointer-events-none" />

      <div className="relative px-3 py-3 sm:px-4 sm:py-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <LiveDot color="rose" />
              <HeatPill tone="rose" pulse>
                Live war room
              </HeatPill>
              <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${volCls}`}>
                {featured.volatility_state}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white uppercase">
              Main event
            </h1>
            <p className="text-sm sm:text-base font-medium text-rose-200/90 mt-1 leading-snug">
              {narrativeHeadline}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1 max-w-2xl">
              Watching competing futures collide · {live || battles.length} live clash
              {(live || battles.length) !== 1 ? "es" : ""} · reputation at stake
            </p>
          </div>
          <Link
            href={battleDetailPath(featured)}
            className="shrink-0 text-[10px] px-2.5 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 transition"
          >
            View Rivalry →
          </Link>
        </div>

        <Link
          href={battleDetailPath(featured)}
          className="block rounded-xl border border-rose-500/25 bg-gradient-to-br from-rose-950/50 via-zinc-950/80 to-violet-950/30 p-3 sm:p-4 mb-3 hover:border-rose-400/40 transition group"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <p className="text-[9px] uppercase tracking-wider text-rose-400/80">
              Highest tension · {featured.contested_market}
            </p>
            <div className="flex items-center gap-2">
              {rankedRivalry && <RankedRivalryLabel />}
              <span className="battle-escalation-pill text-[9px] px-2 py-0.5 rounded-full border border-rose-500/30 text-rose-200 bg-rose-500/10">
                {escalationLabel(featured.escalation_state)}
              </span>
              <MoveBadge delta={featured.spread_delta} />
            </div>
          </div>
          <TaleOfTheTape battle={featured} />
          <p className="text-[11px] text-zinc-500 mt-2.5">{featured.rivalry_memory.headline}</p>
          <p className="text-[10px] text-zinc-400 mt-1.5 line-clamp-2">{featured.last_blow}</p>
        </Link>

        <div className="grid grid-cols-3 gap-2">
          {[
            {
              label: "The bet",
              value: featured.contested_market,
              sub: escalationLabel(featured.escalation_state),
            },
            {
              label: "Consensus",
              value: `${featured.crowd_alignment.favored_pct}% on ${favored.name}`,
              sub: featured.crowd_alignment.pressure_line,
            },
            {
              label: "Momentum",
              value: featured.momentum.label,
              sub: `${attentionLevelLabel(featured.crowd_alignment.attention_level)} · ${featured.conviction_spread}pt spread`,
              highlight: true,
            },
          ].map((s) => (
            <div
              key={s.label}
              className={`rounded-lg border px-2.5 py-2 feed-hover-lift ${
                s.highlight
                  ? "border-rose-500/25 bg-gradient-to-br from-rose-950/40 to-zinc-900/40"
                  : "border-zinc-800/70 bg-zinc-900/40"
              }`}
            >
              <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5">{s.label}</p>
              <p
                className={`text-[11px] sm:text-xs font-semibold line-clamp-2 ${
                  s.highlight ? "text-rose-200" : "text-white"
                }`}
              >
                {s.value}
              </p>
              {s.sub && <p className="text-[9px] text-zinc-600 line-clamp-2 mt-0.5">{s.sub}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
