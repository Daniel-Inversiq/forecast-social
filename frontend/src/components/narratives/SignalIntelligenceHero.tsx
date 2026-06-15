"use client";

import { useEffect, useMemo, useState } from "react";
import { HeatPill, LiveDot } from "@/components/feed/shared";
import { buildHeroStats } from "./narrativeEnrichment";
import type { EnrichedNarrative, MomentumRow } from "./types";

const SUBTITLES = [
  "Weak signals forming across the conviction graph.",
  "Emerging narrative pressure before consensus.",
  "Predictive network intelligence.",
];

export function SignalIntelligenceHero({
  narratives,
  momentum,
}: {
  narratives: EnrichedNarrative[];
  momentum: MomentumRow[];
}) {
  const [tick, setTick] = useState(0);
  const [subtitleIdx, setSubtitleIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setSubtitleIdx((i) => (i + 1) % SUBTITLES.length), 8000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => buildHeroStats(narratives, momentum), [narratives, momentum, tick]);

  return (
    <section className="signals-hero feed-top-signal mb-3 rounded-xl border border-amber-500/12 bg-zinc-950/60 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-r from-amber-950/30 via-violet-950/25 to-teal-950/15 pointer-events-none signals-hero-glow" />
      <div className="absolute inset-y-0 right-1/4 w-px bg-gradient-to-b from-transparent via-violet-500/12 to-transparent pointer-events-none" />
      <div className="relative px-3 py-3 sm:px-4 sm:py-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-[0.35em] text-amber-400/85 font-mono mb-1.5">
              Predictive layer
            </p>
            <div className="flex items-center gap-2 mb-1">
              <LiveDot color="amber" />
              <HeatPill tone="violet" pulse>
                Conviction graph live
              </HeatPill>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              SIGNAL INTELLIGENCE
            </h1>
            <p className="text-[11px] sm:text-xs text-zinc-500 mt-1 max-w-xl transition-opacity duration-700">
              {SUBTITLES[subtitleIdx]}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className={`rounded-lg border px-2.5 py-2 feed-hover-lift ${
                s.highlight
                  ? "border-amber-500/25 bg-gradient-to-br from-amber-950/35 to-zinc-900/40"
                  : "border-zinc-800/70 bg-zinc-900/35"
              }`}
            >
              <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5 flex items-center gap-1">
                {s.pulse && (
                  <span className="h-1 w-1 rounded-full bg-amber-400 feed-live-pill shrink-0" />
                )}
                {s.label}
              </p>
              <p
                className={`text-[10px] sm:text-[11px] font-semibold line-clamp-2 leading-snug ${
                  s.highlight ? "text-amber-100" : "text-white"
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
