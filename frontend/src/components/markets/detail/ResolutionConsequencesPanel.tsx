"use client";

import { isMarketResolved } from "@/lib/resolution";
import type { EnrichedMarketDetail } from "./types";

export function ResolutionConsequencesPanel({ market }: { market: EnrichedMarketDetail }) {
  if (isMarketResolved(market)) return null;

  return (
    <section className="rounded-xl border border-zinc-800/70 bg-gradient-to-b from-zinc-900/50 to-zinc-950/95 p-4 sm:p-5 mb-4">
      <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-600 mb-1">Strategic preview</p>
      <h2 className="text-base font-semibold text-zinc-100 mb-1">
        What happens if this resolves?
      </h2>
      <p className="text-[10px] text-zinc-600 mb-4">
        Reputation shifts, coalition fate, and season implications — not payouts.
      </p>

      <div className="grid md:grid-cols-2 gap-3">
        {market.resolution_scenarios.map((scenario) => (
          <article
            key={scenario.outcome}
            className={`rounded-lg border p-3.5 ${
              scenario.outcome === "YES"
                ? "border-violet-500/25 bg-violet-950/15"
                : "border-zinc-700/50 bg-zinc-900/40"
            }`}
          >
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
              If {scenario.outcome} verifies
            </p>
            <p className="text-sm font-medium text-zinc-200 leading-snug mb-2">
              {scenario.headline}
            </p>
            <p className="text-[10px] text-zinc-500 leading-relaxed mb-3">{scenario.narrative}</p>

            <div className="space-y-2 text-[10px]">
              <div>
                <span className="text-emerald-400/90 font-medium">Gains credibility · </span>
                <span className="text-zinc-400">{scenario.winners.join(", ")}</span>
              </div>
              <div>
                <span className="text-rose-400/90 font-medium">Loses credibility · </span>
                <span className="text-zinc-500">{scenario.losers.join(", ")}</span>
              </div>
              <p className="text-zinc-600 pt-1 border-t border-zinc-800/60">
                <span className="text-zinc-500">Factions · </span>
                {scenario.faction_fate}
              </p>
              <p className="text-violet-400/70 italic">{scenario.season_note}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
