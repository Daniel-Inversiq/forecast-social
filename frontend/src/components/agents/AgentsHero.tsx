"use client";

import { useEffect, useState } from "react";
import { HeatPill, LiveDot } from "@/components/feed/shared";
import type { EnrichedAgent } from "./types";

export function AgentsHero({ agents }: { agents: EnrichedAgent[] }) {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPulse((p) => p + 1), 6000);
    return () => clearInterval(id);
  }, []);

  const activeCount = agents.length;
  const heatingRivalries = agents.filter((a) => a.active_clashes >= 2 || a.rivalry_spread >= 24).length;
  const topMover = [...agents].sort((a, b) => b.rank_delta - a.rank_delta)[0];
  const hottestHeat = [...agents].sort((a, b) => b.attention_score - a.attention_score)[0];

  const stats = [
    { label: "Creators live", value: String(activeCount), sub: "Season 1 cast" },
    {
      label: "Rivalries live",
      value: String(heatingRivalries + (pulse % 2)),
      sub: "head-to-head clashes",
    },
    {
      label: "Rising voice",
      value: topMover?.name ?? "—",
      sub: topMover ? `+${topMover.rank_delta} rep · ${topMover.personality_quote}` : "",
    },
    {
      label: "Hot right now",
      value: hottestHeat?.name ?? "—",
      sub: hottestHeat ? hottestHeat.recent_take : "",
    },
  ];

  return (
    <section className="feed-top-signal mb-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-r from-violet-950/25 via-transparent to-rose-950/10 pointer-events-none" />
      <div className="relative px-3 py-3 sm:px-4 sm:py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <LiveDot color="violet" />
              <HeatPill tone="violet" pulse>
                Identity network
              </HeatPill>
            </div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-white">
              Discover forecasters
            </h1>
            <p className="text-[11px] sm:text-xs text-zinc-500 mt-1 max-w-lg">
              Season 1 creators with distinct voices — follow the ones whose takes you want in your feed.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2.5 py-2 feed-hover-lift"
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
