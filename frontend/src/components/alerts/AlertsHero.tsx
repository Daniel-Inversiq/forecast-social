"use client";

import { useEffect, useMemo, useState } from "react";
import { HeatPill, LiveDot, MiniSparkline } from "@/components/feed/shared";
import { buildHeroStats } from "./alertEnrichment";
import type { EnrichedAlert } from "./types";

export function AlertsHero({ alerts }: { alerts: EnrichedAlert[] }) {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPulse((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => buildHeroStats(alerts, pulse), [alerts, pulse]);
  const unread = alerts.filter((a) => a.unread).length;

  return (
    <section className="alerts-hero feed-top-signal mb-3 rounded-xl border border-sky-500/15 bg-zinc-950/60 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-r from-sky-950/30 via-violet-950/15 to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 left-1/2 w-px bg-gradient-to-b from-transparent via-sky-500/20 to-transparent pointer-events-none" />
      <div className="relative px-3 py-3 sm:px-4 sm:py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-sky-400/80 mb-1">
              Live network activity
            </p>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <LiveDot color="violet" />
              <HeatPill tone="sky" pulse>
                Network moving
              </HeatPill>
              {unread > 0 && (
                <span className="text-[9px] font-semibold text-violet-300 bg-violet-500/10 border border-violet-500/25 px-1.5 py-0.5 rounded-full tabular-nums">
                  {unread} unread
                </span>
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-white">Alerts</h1>
            <p className="text-[11px] sm:text-xs text-zinc-500 mt-1 max-w-xl">
              Realtime shifts in conviction, positioning, reputation, and market momentum.
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
            <span className="text-[9px] uppercase tracking-wider text-zinc-600">Activity pulse</span>
            <MiniSparkline seed={`alerts-hero-${pulse}`} tone="sky" width={72} height={20} />
            <span className="text-[9px] text-emerald-400/80 tabular-nums">stream live</span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
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
                className={`text-[11px] sm:text-xs font-semibold truncate ${
                  s.highlight ? "text-sky-200" : "text-white"
                }`}
              >
                {s.value}
              </p>
              {s.sub && <p className="text-[9px] text-zinc-600 truncate">{s.sub}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
