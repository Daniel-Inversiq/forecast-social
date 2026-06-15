"use client";

import { buildHeatmap } from "./signalIntelligence";
import type { EnrichedNarrative, MomentumRow } from "./types";

function cellIntensity(value: number, max = 12) {
  return Math.min(1, value / max);
}

export function SignalHeatmap({
  narratives,
  momentum,
}: {
  narratives: EnrichedNarrative[];
  momentum: MomentumRow[];
}) {
  const cells = buildHeatmap(narratives, momentum);

  return (
    <section className="mb-3 rounded-xl border border-zinc-800/70 bg-zinc-950/50 p-3 sm:p-3.5 overflow-hidden">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Pressure heatmap
          </h2>
          <p className="text-[10px] text-zinc-600 mt-0.5">
            Building pressure · fragmentation · consensus · volatility migration
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {cells.map((cell) => {
          const p = cellIntensity(cell.pressure);
          const f = cellIntensity(cell.fragmentation, 90);
          return (
            <div
              key={cell.sector}
              className="signals-heatmap-cell rounded-lg border border-zinc-800/70 p-2.5 relative overflow-hidden feed-hover-lift"
              style={{
                background: `linear-gradient(135deg, rgba(251,191,36,${p * 0.12}) 0%, rgba(139,92,246,${f * 0.1}) 50%, rgba(20,184,166,${cellIntensity(cell.consensus, 100) * 0.08}) 100%)`,
              }}
            >
              <p className="text-[10px] font-semibold text-zinc-200 mb-2">{cell.sector}</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[8px]">
                  <span className="text-zinc-600">Pressure</span>
                  <span className="text-amber-300/90 tabular-nums font-medium">
                    {cell.pressure.toFixed(1)}
                  </span>
                </div>
                <div className="h-0.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-500/70 rounded-full"
                    style={{ width: `${Math.min(100, cell.pressure * 8)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[8px]">
                  <span className="text-zinc-600">Fragment</span>
                  <span className="text-violet-300/80 tabular-nums">{cell.fragmentation}%</span>
                </div>
                <div className="flex justify-between text-[8px]">
                  <span className="text-zinc-600">Consensus</span>
                  <span className="text-teal-300/80 tabular-nums">{Math.round(cell.consensus)}%</span>
                </div>
                <div className="flex justify-between text-[8px]">
                  <span className="text-zinc-600">Vol migration</span>
                  <span className="text-zinc-500 tabular-nums">{cell.volatility_migration}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
