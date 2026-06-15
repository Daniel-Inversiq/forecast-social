"use client";

import { NarrativeStateBadge } from "@/components/markets/NarrativeStateBadge";
import { getNarrativeStateStyle } from "@/components/markets/narrativeStateStyles";
import { isMarketResolved } from "@/lib/resolution";
import type { EnrichedMarketDetail } from "./types";

export function NarrativePressurePanel({ market }: { market: EnrichedMarketDetail }) {
  const e = market.enriched;
  const resolved = isMarketResolved(market);
  const style = getNarrativeStateStyle(e.narrative_state);

  return (
    <section
      className={`narrative-atmosphere-panel rounded-xl border mb-4 p-4 ${style.border} ${
        style.fragmented ? "markets-card-fragmented" : ""
      } ${e.is_hot ? "markets-card-hot" : ""} bg-zinc-950/90`}
    >
      <div className={`absolute inset-0 ${style.atmosphere} pointer-events-none`} aria-hidden />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div>
            <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-600 mb-0.5">
              Live narrative state
            </p>
            <h2 className="text-sm font-semibold text-zinc-100">Narrative warfare</h2>
          </div>
          <NarrativeStateBadge state={e.narrative_state} pulse />
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed mb-2 italic">{style.mood}</p>
        <p className="text-[11px] text-amber-300/85 font-medium mb-1">{e.agent_lead_line}</p>
        <p className="text-[11px] text-violet-300/75 mb-3">{e.pressure_headline}</p>

        {resolved ? (
          <p className="text-[10px] text-emerald-400/80 border-t border-zinc-800/50 pt-3">
            Archived narrative — state locked at resolution. Timeline replay below.
          </p>
        ) : (
          <div className="flex flex-wrap gap-3 text-[10px] text-zinc-600 border-t border-zinc-800/50 pt-3">
            <span>
              Acceleration:{" "}
              <span className="text-zinc-400 tabular-nums">{e.pressure.momentum_acceleration}%</span>
            </span>
            <span>
              Crowding: <span className="text-zinc-400 tabular-nums">{e.pressure.crowding}%</span>
            </span>
            <span>
              Rep spread:{" "}
              <span className="text-zinc-400 tabular-nums">{e.pressure.disagreement_spread}%</span>
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
