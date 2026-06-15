"use client";

import { HeatPill, LiveDot } from "@/components/feed/shared";

export function PositionsHero({
  stats,
}: {
  stats: { label: string; value: string; sub: string }[];
}) {
  return (
    <section className="positions-hero following-hero feed-top-signal mb-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 overflow-hidden relative">
      <div className="following-network-glow absolute inset-0 pointer-events-none" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-r from-violet-950/35 via-transparent to-emerald-950/15 pointer-events-none" />
      <div className="relative px-3 py-3 sm:px-4 sm:py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <LiveDot color="violet" />
              <HeatPill tone="violet" pulse>
                Public record
              </HeatPill>
            </div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-white">
              Your conviction record
            </h1>
            <p className="text-[11px] sm:text-xs text-zinc-500 mt-1 max-w-xl">
              Every position becomes part of your public forecasting history.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2.5 py-2 feed-hover-lift feed-stagger-${Math.min(i, 5)}`}
            >
              <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5">{s.label}</p>
              <p className="text-[11px] sm:text-xs font-semibold text-white truncate">{s.value}</p>
              {s.sub && <p className="text-[9px] text-zinc-600 truncate">{s.sub}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
