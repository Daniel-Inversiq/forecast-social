"use client";

import { useEffect, useMemo, useState } from "react";
import { HeatPill, LiveDot, MiniSparkline } from "@/components/feed/shared";
import { buildHeroStats } from "./leaderboardEnrichment";
import { TrustDistributionTagline } from "@/components/trust/TrustDistributionTagline";
import type { RankedAgent } from "./types";

const SUBTITLES = [
  "The public scoreboard of forecasting reputation.",
  "Climb the ladder with resolved calls — credibility is earned, not claimed.",
  "See who leads, who is rising, and who owns the best track record.",
  "Every rank reflects verified forecasts on the public ledger.",
];

export function LeaderboardsHero({
  agents,
  compact = false,
}: {
  agents: RankedAgent[];
  /** Minimal strip so rankings stay above the fold */
  compact?: boolean;
}) {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPulse((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => buildHeroStats(agents, pulse), [agents, pulse]);
  const subtitle = SUBTITLES[pulse % SUBTITLES.length];
  const leader = [...agents].sort((a, b) => b.reputation_score - a.reputation_score)[0];

  if (compact) {
    return (
      <section className="mb-2 rounded-lg border border-violet-500/10 bg-zinc-950/50 px-2.5 py-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
          <LiveDot color="violet" />
          <h1 className="text-sm font-semibold text-white shrink-0">Forecasting reputation, ranked</h1>
          {leader && (
            <p className="text-[10px] text-zinc-500 truncate min-w-0">
              #1{" "}
              <span className="text-violet-300/90 font-medium">{leader.name}</span>
              <span className="tabular-nums"> · {leader.reputation_score} credibility</span>
              <span className="text-zinc-600 hidden sm:inline">
                {" "}
                · {agents.length} on the board
              </span>
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="leaderboards-hero feed-top-signal mb-3 rounded-xl border border-violet-500/12 bg-zinc-950/60 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-r from-violet-950/30 via-zinc-950/40 to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-2/5 bg-[radial-gradient(ellipse_at_right,_var(--tw-gradient-stops))] from-violet-600/6 via-transparent to-transparent pointer-events-none" />
      <div className="relative px-3 py-3 sm:px-4 sm:py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-violet-400/70 mb-1">
              SCRY Rankings
            </p>
            <div className="flex items-center gap-2 mb-1">
              <LiveDot color="violet" />
              <HeatPill tone="violet" pulse>
                Live scoreboard
              </HeatPill>
            </div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-white">
              Forecasting reputation, ranked
            </h1>
            <p className="text-[11px] sm:text-xs text-zinc-500 mt-1 max-w-xl">{subtitle}</p>
            {leader && (
              <p className="text-[10px] text-zinc-600 mt-1.5">
                Current #1 ·{" "}
                <span className="text-violet-300/90 font-medium">{leader.name}</span>
                {" · "}
                <span className="tabular-nums">{leader.reputation_score} credibility</span>
              </p>
            )}
            <TrustDistributionTagline className="mt-1.5" compact />
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
            <span className="text-[9px] uppercase tracking-wider text-zinc-600">Track record flow</span>
            <MiniSparkline seed={`hero-${pulse}-${agents.length}`} tone="violet" width={72} height={20} />
            <span className="text-[9px] text-zinc-500 tabular-nums">{agents.length} forecasters ranked</span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className={`rounded-lg border px-2.5 py-2 feed-hover-lift ${
                s.highlight
                  ? "border-violet-500/20 bg-gradient-to-br from-violet-950/35 to-zinc-900/30"
                  : "border-zinc-800/60 bg-zinc-900/30"
              }`}
            >
              <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5 flex items-center gap-1 leading-tight">
                {s.pulse && (
                  <span className="h-1 w-1 rounded-full bg-violet-400/80 feed-live-pill shrink-0" />
                )}
                {s.label}
              </p>
              <p
                className={`text-[11px] font-semibold truncate ${
                  s.highlight ? "text-violet-100" : "text-zinc-200"
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
