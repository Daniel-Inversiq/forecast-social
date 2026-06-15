"use client";

import Link from "next/link";
import { beliefPath, rankBeliefsByType } from "./beliefEnrichment";
import { beliefsEnabled } from "@/lib/featureFlags";
import type { BeliefRankingTypeKey, EnrichedBelief } from "./types";

const RANKING_TABS: { key: BeliefRankingTypeKey; label: string }[] = [
  { key: "top_champions", label: "Top Belief Champions" },
  { key: "most_accurate", label: "Most Accurate Beliefs" },
  { key: "fastest_rising", label: "Fastest Rising Beliefs" },
  { key: "highest_credibility", label: "Highest Credibility Beliefs" },
  { key: "most_contested", label: "Most Contested Beliefs" },
];

export function BeliefRankingsPanel({
  beliefs,
  rankingType,
  onRankingTypeChange,
  compact = false,
}: {
  beliefs: EnrichedBelief[];
  rankingType: BeliefRankingTypeKey;
  onRankingTypeChange: (k: BeliefRankingTypeKey) => void;
  compact?: boolean;
}) {
  if (!beliefsEnabled()) return null;

  const ranked = rankBeliefsByType(beliefs, rankingType).slice(0, compact ? 4 : 8);

  return (
    <section
      className={`rounded-xl border border-amber-500/15 bg-zinc-950/50 space-y-2 ${
        compact ? "p-2.5" : "p-4 space-y-3"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className={`font-semibold text-white ${compact ? "text-xs" : "text-sm"}`}>
          Belief rankings
        </h3>
        <Link href="/beliefs" className="text-[10px] text-amber-400/90 hover:text-amber-300">
          All beliefs →
        </Link>
      </div>
      <div className="flex gap-1 overflow-x-auto feed-scroll-x scrollbar-none pb-0.5">
        {RANKING_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onRankingTypeChange(tab.key)}
            className={`shrink-0 text-[10px] px-2 py-0.5 rounded-md border transition ${
              rankingType === tab.key
                ? "bg-amber-500/12 text-amber-200 border-amber-500/30"
                : "text-zinc-600 border-transparent hover:text-zinc-400"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <ol className="space-y-1.5">
        {ranked.map((b) => (
          <li key={b.slug}>
            <Link
              href={beliefPath(b.slug)}
              className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-zinc-900/60 transition"
            >
              <span className="text-[10px] font-mono text-amber-400/70 w-5">#{b.rank}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-zinc-200 truncate">{b.title}</p>
                {b.champion_name && rankingType === "top_champions" && (
                  <p className="text-[9px] text-zinc-600 truncate">{b.champion_name}</p>
                )}
              </div>
              <span className="text-[10px] text-zinc-500 tabular-nums shrink-0">
                {rankingType === "most_accurate"
                  ? `${b.historical_win_rate}%`
                  : rankingType === "fastest_rising"
                    ? `+${b.momentum}`
                    : rankingType === "highest_credibility"
                      ? b.supporting_credibility.toLocaleString()
                      : rankingType === "most_contested"
                        ? b.contested_score
                        : b.champions[0]?.credibility ?? "—"}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
