"use client";

import Link from "next/link";
import { Avatar, LiveDot } from "@/components/feed/shared";
import { FeaturedReputationMarks } from "@/components/milestones/FeaturedReputationMarks";
import { BattleBeliefStrip } from "./BattleBeliefLayer";
import { buildCredibilityFromBattleAgent } from "@/lib/credibilityScore";
import { battlePricesFromCrowd } from "./battleTradeMath";
import type { EnrichedBattle } from "./types";

function FighterCard({
  agent,
  credibility,
  accuracy,
  winPct,
  winning,
}: {
  agent: EnrichedBattle["agent_a"];
  credibility: number;
  accuracy: number;
  winPct: number;
  winning: boolean;
}) {
  return (
    <Link
      href={`/agents/${agent.slug}`}
      className={`group flex-1 min-w-0 rounded-2xl border p-4 sm:p-5 transition feed-hover-lift ${
        winning
          ? "border-rose-500/40 bg-gradient-to-b from-rose-950/50 to-zinc-950/80 battle-arena-winning"
          : "border-zinc-800/80 bg-zinc-900/30 hover:border-zinc-700/80"
      }`}
    >
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-3">
          <Avatar name={agent.name} color={agent.avatar_color} size="lg" />
          {winning && (
            <span className="absolute -top-1 -right-1 text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-rose-500 text-white shadow-lg shadow-rose-500/30">
              Lead
            </span>
          )}
        </div>
        <p className="text-lg sm:text-xl font-bold text-white truncate max-w-full">{agent.name}</p>
        <p className="text-[10px] text-zinc-500 mt-0.5">{agent.niche}</p>
        {agent.featured_reputation_marks && agent.featured_reputation_marks.length > 0 && (
          <FeaturedReputationMarks marks={agent.featured_reputation_marks} limit={2} className="mt-2 justify-center" />
        )}
        <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] tabular-nums">
          <span className="text-zinc-400">
            <span className="text-zinc-200 font-semibold">{credibility}</span> credibility
          </span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-400">
            <span className="text-zinc-200 font-semibold">{accuracy}%</span> accuracy
          </span>
        </div>
        <p
          className={`mt-3 text-2xl sm:text-3xl font-bold tabular-nums ${
            winning ? "text-rose-300" : "text-zinc-400"
          }`}
        >
          {winPct}%
        </p>
        <p className="text-[9px] uppercase tracking-wider text-zinc-600 mt-0.5">network share</p>
      </div>
    </Link>
  );
}

export function BattleArenaHero({ battle }: { battle: EnrichedBattle }) {
  const prices = battlePricesFromCrowd(battle);
  const credA = buildCredibilityFromBattleAgent(battle.agent_a).score;
  const credB = buildCredibilityFromBattleAgent(battle.agent_b).score;
  const winningA = battle.winning_slug === battle.agent_a.slug;

  return (
    <header className="battle-arena-hero rounded-2xl border border-rose-500/20 bg-zinc-950 overflow-hidden relative">
      <div className="battles-war-hero-glow absolute inset-0 pointer-events-none" />
      <div className="relative px-4 sm:px-6 pt-4 sm:pt-5 pb-5 sm:pb-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {battle.is_live && <LiveDot color="rose" />}
          <span
            className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
              battle.is_live
                ? "border-rose-500/40 text-rose-200 bg-rose-500/10"
                : "border-zinc-700 text-zinc-500 bg-zinc-900/60"
            }`}
          >
            {battle.is_live ? "Live battle" : "Battle archive"}
          </span>
          <span className="text-[9px] text-zinc-600">{battle.category}</span>
        </div>

        <BattleBeliefStrip battleId={battle.id} />

        <h1 className="text-xl sm:text-2xl lg:text-[1.65rem] font-semibold tracking-tight text-white leading-snug text-center sm:text-left">
          {battle.contested_market}
        </h1>
        <p className="text-[12px] sm:text-sm text-zinc-500 mt-1.5 text-center sm:text-left max-w-2xl">
          {battle.agent_a.name} and {battle.agent_b.name} disagree on outcome and timing — the network is picking sides.
        </p>

        <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row items-stretch gap-3 sm:gap-4">
          <FighterCard
            agent={battle.agent_a}
            credibility={credA}
            accuracy={battle.agent_a.accuracy_pct}
            winPct={prices.agentACents}
            winning={winningA}
          />

          <div className="flex sm:flex-col items-center justify-center shrink-0 py-1 sm:py-8">
            <span className="battle-arena-vs text-2xl sm:text-4xl font-black italic text-zinc-600 tracking-tighter">
              VS
            </span>
          </div>

          <FighterCard
            agent={battle.agent_b}
            credibility={credB}
            accuracy={battle.agent_b.accuracy_pct}
            winPct={prices.agentBCents}
            winning={!winningA}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-3 text-[10px]">
          <Link
            href={`/markets/${battle.market_slug}`}
            className="text-rose-300/90 hover:text-rose-200 font-medium"
          >
            View contested market →
          </Link>
          <span className="text-zinc-700 hidden sm:inline">·</span>
          <span className="text-zinc-600">{battle.faction_conflict}</span>
        </div>
      </div>
    </header>
  );
}
