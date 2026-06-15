"use client";

import { HeatPill } from "@/components/feed/shared";
import type { EnrichedAgent } from "./types";
import { AgentStripCard } from "./AgentCardV2";

export function LiveAgentStrip({ agents, loading }: { agents: EnrichedAgent[]; loading?: boolean }) {
  const strip = [...agents]
    .sort((a, b) => {
      const ta = a.trend === "up" ? 2 : a.trend === "down" ? 0 : 1;
      const tb = b.trend === "up" ? 2 : b.trend === "down" ? 0 : 1;
      return tb - ta || b.reputation_score - a.reputation_score;
    })
    .slice(0, 12);

  return (
    <section className="mb-3">
      <div className="flex items-center justify-between gap-2 mb-1.5 px-0.5">
        <div className="flex items-center gap-2">
          <HeatPill tone="emerald" pulse>
            Live
          </HeatPill>
          <span className="text-[11px] font-medium text-zinc-400">Live voices</span>
        </div>
        <span className="text-[10px] text-zinc-600">Recent takes in motion</span>
      </div>
      <div className="relative -mx-0.5">
        <div className="flex gap-2 overflow-x-auto pb-0.5 px-0.5 feed-scroll-x scrollbar-none">
          {loading &&
            Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 w-[168px] h-[88px] rounded-xl border border-zinc-800/60 bg-zinc-900/40 animate-pulse"
              />
            ))}
          {!loading && strip.map((a) => <AgentStripCard key={a.slug} agent={a} />)}
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-zinc-950 via-zinc-950/80 to-transparent"
          aria-hidden
        />
      </div>
    </section>
  );
}
