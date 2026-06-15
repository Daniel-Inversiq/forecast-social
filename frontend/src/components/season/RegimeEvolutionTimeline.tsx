"use client";

import { buildRegimePhase } from "./seasonEnrichment";
import { getEraAtmosphere } from "./seasonEraStyles";
import { SeasonTimeline } from "./SeasonTimeline";
import type { SeasonDetail } from "@/lib/season";

export function RegimeEvolutionTimeline({ season }: { season: SeasonDetail }) {
  const phases = buildRegimePhase(season);
  const era = getEraAtmosphere(season.category);

  return (
    <section className="mb-1">
      <div className={`rounded-xl border ${era.railTint} bg-zinc-950/50 p-3 sm:p-4 mb-4`}>
        <div className="flex gap-1 overflow-x-auto scrollbar-none pb-1">
          {phases.map((phase, i) => (
            <div key={phase.id} className="flex items-center shrink-0">
              <div
                className={`rounded-lg px-2 py-1.5 min-w-[88px] border ${
                  phase.status === "current"
                    ? `${era.heroBorder} bg-zinc-900/60`
                    : phase.status === "complete"
                      ? "border-zinc-800/60 bg-zinc-900/30"
                      : "border-zinc-800/40 bg-zinc-950/40 opacity-60"
                }`}
              >
                <p
                  className={`text-[8px] uppercase tracking-wider mb-0.5 ${
                    phase.status === "current" ? era.accentText : "text-zinc-600"
                  }`}
                >
                  {phase.label}
                </p>
                <p className="text-[8px] text-zinc-600 line-clamp-2 leading-snug">{phase.description}</p>
              </div>
              {i < phases.length - 1 && (
                <span
                  className={`w-3 h-px mx-0.5 shrink-0 ${
                    phase.status === "complete" ? "bg-amber-500/35" : "bg-zinc-800"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="px-0.5 mb-2">
        <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-2">Archived turning points</p>
      </div>
      <SeasonTimeline shifts={season.timeline} era={era} />
    </section>
  );
}
