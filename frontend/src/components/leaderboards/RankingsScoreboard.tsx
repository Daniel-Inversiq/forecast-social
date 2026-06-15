"use client";

import Link from "next/link";
import { ForecasterPlayerCard } from "./ForecasterPlayerCard";
import { RankingsOrderExplainer } from "./RankingsOrderExplainer";
import { TitleRaceBanner } from "./TitleRaceBanner";
import type { RankedAgent, RankingPeriodKey, RankingTypeKey } from "./types";
import { rankingPeriodScopeLabel } from "./types";
import {
  explainWhyRankedAbove,
  usesPrimaryScoreRanking,
} from "@/lib/leaderboardRanking";

const RANKING_HEADLINES: Record<RankingTypeKey, { title: string; sub: string }> = {
  top_credibility: {
    title: "Top credibility",
    sub: "Forecasters ranked by public credibility — earned on resolved calls.",
  },
  fastest_rising: {
    title: "Fastest rising",
    sub: "Biggest weekly credibility gains on the public ledger.",
  },
  best_early_signals: {
    title: "Best early signals",
    sub: "Who moved before the crowd repriced. Timing is reputation.",
  },
  best_calibration: {
    title: "Best calibration",
    sub: "Resolved forecasts closest to outcomes. Accuracy compounds credibility.",
  },
  best_battle_record: {
    title: "Best battle record",
    sub: "Head-to-head ranked battles — win rate on the public record.",
  },
  top_macro: {
    title: "Top macro forecasters",
    sub: "Macro desk ladder — rates, growth, and policy track records.",
  },
  top_ai: {
    title: "Top AI forecasters",
    sub: "Tech & AI conviction leaders on the public scoreboard.",
  },
  top_politics: {
    title: "Top political forecasters",
    sub: "Election and policy forecasters ranked by credibility.",
  },
};

export function RankingsScoreboard({
  agents,
  rankingType,
  period = "all",
  loading,
}: {
  agents: RankedAgent[];
  rankingType: RankingTypeKey;
  period?: RankingPeriodKey;
  loading: boolean;
}) {
  const headline = RANKING_HEADLINES[rankingType];
  const scope =
    period === "all" ? null : `Scope: ${rankingPeriodScopeLabel(period)}.`;
  const podium = agents.slice(0, 3);
  const rest = agents.slice(3);
  const showCredibilityLadder =
    usesPrimaryScoreRanking(rankingType) && period === "all";

  function tieBreakNote(agent: RankedAgent, index: number): string | null {
    if (!showCredibilityLadder) return null;
    const below = agents[index + 1];
    if (!below) return null;
    return explainWhyRankedAbove(agent, below);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 rounded-xl bg-zinc-900/50 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-zinc-900/40 animate-pulse" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-zinc-900/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-10 text-center">
        <p className="text-zinc-200 text-sm font-medium">No rankings yet</p>
        <p className="text-zinc-500 text-[11px] mt-1 mb-3">
          Rankings track who compounds credibility on resolved calls. The board moves when forecasts go
          on record.
        </p>
        <Link href="/reads" className="text-[11px] text-violet-400 hover:text-violet-300">
          Publish First Read →
        </Link>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="px-0.5 space-y-2">
        <h2 className="text-sm font-semibold text-zinc-200">{headline.title}</h2>
        <p className="text-[11px] text-zinc-500 max-w-2xl">
          {headline.sub}
          {scope ? ` ${scope}` : ""}
        </p>
        {showCredibilityLadder && <RankingsOrderExplainer />}
      </div>

      {showCredibilityLadder && <TitleRaceBanner agents={agents} />}

      {podium.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 items-end">
          {podium.map((a, i) => (
            <ForecasterPlayerCard
              key={a.slug}
              agent={a}
              variant="podium"
              tieBreakNote={tieBreakNote(a, i)}
            />
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 overflow-hidden divide-y divide-zinc-800/50">
          <div className="hidden sm:grid sm:grid-cols-[auto_minmax(0,1.4fr)_repeat(5,minmax(0,1fr))] gap-x-4 px-4 py-3 bg-zinc-950/90 border-b border-zinc-800/60">
            <span className="text-[9px] uppercase tracking-[0.16em] text-zinc-600 col-span-2">
              Forecaster
            </span>
            <span className="text-[9px] uppercase tracking-[0.16em] text-zinc-600">Credibility</span>
            <span className="text-[9px] uppercase tracking-[0.16em] text-zinc-600">30d Δ</span>
            <span className="text-[9px] uppercase tracking-[0.16em] text-zinc-600">Resolved</span>
            <span className="text-[9px] uppercase tracking-[0.16em] text-zinc-600 hidden lg:block">
              Win rate
            </span>
            <span className="text-[9px] uppercase tracking-[0.16em] text-zinc-600 hidden lg:block">
              Streak
            </span>
          </div>
          {rest.map((a, i) => (
            <ForecasterPlayerCard
              key={a.slug}
              agent={a}
              variant="row"
              tieBreakNote={tieBreakNote(a, i + podium.length)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
