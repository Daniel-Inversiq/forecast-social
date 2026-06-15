"use client";

import { HeatPill, LiveDot } from "@/components/feed/shared";
import type { NetworkBriefLine } from "./types";

const BRIEF_TONE: Record<NetworkBriefLine["tone"], string> = {
  violet: "text-violet-300/90",
  rose: "text-rose-300/90",
  emerald: "text-emerald-300/90",
  sky: "text-sky-300/90",
  amber: "text-amber-300/90",
};

export function FollowingHero({
  stats,
  briefLines = [],
}: {
  stats: { label: string; value: string; sub: string }[];
  briefLines?: NetworkBriefLine[];
}) {
  return (
    <section className="following-hero feed-top-signal mb-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 overflow-hidden relative">
      <div className="following-network-glow absolute inset-0 pointer-events-none" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-r from-violet-950/35 via-transparent to-emerald-950/20 pointer-events-none" />
      <div className="relative px-3 py-3 sm:px-4 sm:py-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <LiveDot color="violet" />
              <HeatPill tone="violet" pulse>
                Private network
              </HeatPill>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              YOUR NETWORK
            </h1>
            <p className="text-[11px] sm:text-xs text-zinc-500 mt-1 max-w-xl">
              The conviction graph you chose. Personalized forecasting intelligence — your private
              narrative ecosystem.
            </p>
          </div>
        </div>

        {briefLines.length > 0 && (
          <ul className="mb-3 space-y-1 border-l-2 border-violet-500/30 pl-2.5">
            {briefLines.map((line) => (
              <li key={line.id} className={`text-[11px] leading-snug ${BRIEF_TONE[line.tone]}`}>
                {line.text}
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2 py-1.5 feed-hover-lift feed-stagger-${Math.min(i, 4)}`}
            >
              <p className="text-[7px] uppercase tracking-wider text-zinc-600 mb-0.5 leading-tight">
                {s.label}
              </p>
              <p className="text-[11px] font-semibold text-white truncate tabular-nums">{s.value}</p>
              {s.sub && <p className="text-[8px] text-zinc-600 truncate">{s.sub}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
