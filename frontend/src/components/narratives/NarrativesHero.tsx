"use client";

import { useEffect, useMemo, useState } from "react";
import { HeatPill, LiveDot } from "@/components/feed/shared";
import { buildHeroStats } from "./narrativeEnrichment";
import type { EnrichedNarrative, MomentumRow } from "./types";

export function NarrativesHero({
  narratives,
  momentum,
}: {
  narratives: EnrichedNarrative[];
  momentum: MomentumRow[];
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => buildHeroStats(narratives, momentum), [narratives, momentum, tick]);

  return (
    <section className="narratives-hero feed-top-signal mb-3 rounded-xl border border-sky-500/15 bg-zinc-950/60 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-r from-sky-950/35 via-violet-950/20 to-transparent pointer-events-none narratives-hero-glow" />
      <div className="absolute inset-y-0 left-1/3 w-px bg-gradient-to-b from-transparent via-sky-500/15 to-transparent pointer-events-none" />
      <div className="relative px-3 py-3 sm:px-4 sm:py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-[0.35em] text-sky-400/90 font-mono mb-1.5">
              Narrative engine
            </p>
            <div className="flex items-center gap-2 mb-1">
              <LiveDot color="violet" />
              <HeatPill tone="sky" pulse>
                Live conviction map
              </HeatPill>
            </div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-white">Narratives</h1>
            <p className="text-[11px] sm:text-xs text-zinc-500 mt-1 max-w-xl">
              Where collective conviction starts moving.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className={`rounded-lg border px-2.5 py-2 feed-hover-lift ${
                s.highlight
                  ? "border-sky-500/25 bg-gradient-to-br from-sky-950/40 to-zinc-900/40"
                  : "border-zinc-800/70 bg-zinc-900/40"
              }`}
            >
              <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5 flex items-center gap-1">
                {s.pulse && (
                  <span className="h-1 w-1 rounded-full bg-sky-400 feed-live-pill shrink-0" />
                )}
                {s.label}
              </p>
              <p
                className={`text-[10px] sm:text-[11px] font-semibold line-clamp-2 leading-snug ${
                  s.highlight ? "text-sky-200" : "text-white"
                }`}
              >
                {s.value}
              </p>
              {s.sub && <p className="text-[9px] text-zinc-600 truncate mt-0.5">{s.sub}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
