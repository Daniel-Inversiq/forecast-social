"use client";

import { MiniSparkline } from "@/components/feed/shared";
import { buildRadarCards } from "./signalIntelligence";
import { PRESSURE_LABELS } from "./types";
import type { EnrichedNarrative } from "./types";

const PRESSURE_TONE: Record<string, string> = {
  accelerating: "text-amber-300/90 border-amber-500/25",
  collapsing: "text-rose-300/90 border-rose-500/25",
  aligning: "text-teal-300/90 border-teal-500/25",
  fragmenting: "text-violet-300/90 border-violet-500/25",
  repricing: "text-zinc-300/90 border-zinc-500/25",
  tightening: "text-amber-200/90 border-amber-500/20",
  migrating: "text-cyan-300/90 border-cyan-500/25",
  concentrating: "text-violet-200/90 border-violet-500/30",
};

const STAGE_TONE: Record<string, string> = {
  FORMING: "text-zinc-400",
  CLUSTERING: "text-amber-300/80",
  CONTESTED: "text-violet-300/80",
  BREAKOUT: "text-teal-300/90",
  MAINSTREAM: "text-zinc-500",
  COLLAPSING: "text-rose-300/80",
};

export function NetworkPressureRadar({ narratives }: { narratives: EnrichedNarrative[] }) {
  const cards = buildRadarCards(narratives);

  return (
    <section className="mb-3">
      <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Network Pressure Radar
          </h2>
          <p className="text-[10px] text-zinc-600 mt-0.5">
            Acceleration · alignment · fragmentation across the graph
          </p>
        </div>
      </div>
      <div className="relative -mx-0.5">
        <div className="flex gap-2 overflow-x-auto pb-1 px-0.5 feed-scroll-x scrollbar-none">
          {cards.map((card) => (
            <article
              key={card.id}
              className="signals-radar-card shrink-0 w-[220px] sm:w-[248px] flex flex-col gap-2 p-3 rounded-xl border border-zinc-800/80 bg-zinc-950/85 feed-hover-lift relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-violet-600/6 via-transparent to-amber-600/5 pointer-events-none" />
              <div className="relative flex items-start justify-between gap-2">
                <span
                  className={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${PRESSURE_TONE[card.pressure_direction] ?? PRESSURE_TONE.accelerating}`}
                >
                  {PRESSURE_LABELS[card.pressure_direction]}
                </span>
                <span className={`text-[8px] font-mono uppercase ${STAGE_TONE[card.signal_stage]}`}>
                  {card.signal_stage}
                </span>
              </div>
              <p className="relative text-[12px] font-semibold text-white leading-snug line-clamp-2 min-h-[2.5rem]">
                {card.narrative}
              </p>
              <div className="relative grid grid-cols-2 gap-x-2 gap-y-1 text-[9px]">
                <div>
                  <span className="text-zinc-600 block">Acceleration</span>
                  <span className="text-amber-300/95 font-semibold tabular-nums text-sm">
                    {card.acceleration_score}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-600 block">Rep density</span>
                  <span className="text-violet-300/95 font-semibold tabular-nums text-sm">
                    {card.rep_density}%
                  </span>
                </div>
              </div>
              <div className="relative flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[8px] text-zinc-600 mb-0.5">Affected sectors</p>
                  <p className="text-[9px] text-zinc-500 truncate">{card.sectors.join(" · ")}</p>
                </div>
                <MiniSparkline seed={card.seed} tone="amber" width={56} height={18} />
              </div>
            </article>
          ))}
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-zinc-950 to-transparent"
          aria-hidden
        />
      </div>
    </section>
  );
}
