"use client";

import { useEffect, useMemo, useState } from "react";
import { HeatPill, LiveDot } from "@/components/feed/shared";
import { buildHeroStats } from "./verifiedCallEnrichment";
import type { EnrichedVerifiedCall } from "./types";

export function VerifiedCallsHero({ calls }: { calls: EnrichedVerifiedCall[] }) {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPulse((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const stats = useMemo(() => buildHeroStats(calls, pulse), [calls, pulse]);

  return (
    <section className="verified-calls-hero feed-top-signal mb-3 rounded-xl border border-amber-500/15 bg-zinc-950/60 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-r from-amber-950/30 via-zinc-950/50 to-violet-950/10 pointer-events-none" />
      <div className="absolute inset-y-0 left-1/2 w-px bg-gradient-to-b from-transparent via-amber-500/15 to-transparent pointer-events-none" />
      <div className="relative px-3 py-3 sm:px-4 sm:py-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-amber-400/80 mb-1">
              Historical proof · timing receipts
            </p>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <LiveDot color="amber" />
              <HeatPill tone="amber">Verification archive</HeatPill>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white/95">
              VERIFICATION ARCHIVE
            </h1>
            <p className="text-[11px] sm:text-xs text-zinc-500 mt-1.5 max-w-xl leading-relaxed">
              Historical proof across the conviction graph. Where narratives became reality — timing,
              conviction, and public receipts.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className={`rounded-lg border px-2.5 py-2.5 feed-hover-lift ${
                s.highlight
                  ? "border-amber-500/25 bg-gradient-to-br from-amber-950/35 to-zinc-900/40"
                  : "border-zinc-800/70 bg-zinc-900/35"
              }`}
            >
              <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5 flex items-center gap-1">
                {s.pulse && (
                  <span className="h-1 w-1 rounded-full bg-amber-400/90 feed-live-pill shrink-0" />
                )}
                {s.label}
              </p>
              <p
                className={`text-[12px] sm:text-sm font-semibold truncate ${
                  s.highlight ? "text-amber-100/95" : "text-zinc-100"
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
