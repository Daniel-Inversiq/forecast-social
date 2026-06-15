"use client";

import { HeatPill, LiveDot } from "@/components/feed/shared";
import type { ConvictionCommandCenter } from "./types";

const TONE_TEXT: Record<string, string> = {
  violet: "text-violet-300",
  amber: "text-amber-300",
  teal: "text-teal-300",
  rose: "text-rose-300",
  emerald: "text-emerald-300",
  sky: "text-sky-300",
};

const TONE_BORDER: Record<string, string> = {
  violet: "border-violet-500/20",
  amber: "border-amber-500/20",
  teal: "border-teal-500/25",
  rose: "border-rose-500/20",
  emerald: "border-emerald-500/20",
  sky: "border-sky-500/20",
};

export function ConvictionCommandHero({ center }: { center: ConvictionCommandCenter }) {
  const headline = [
    { label: "Net conviction exposure", value: `€${center.net_exposure}`, tone: "violet" },
    { label: "Reputation at risk", value: String(center.reputation_at_risk), tone: "rose" },
    { label: "Active narratives", value: String(center.active_narratives), tone: "teal" },
    { label: "Markets under pressure", value: String(center.markets_under_pressure), tone: "amber" },
    { label: "Verification proximity", value: String(center.verification_proximity), tone: "emerald" },
    {
      label: "Consensus alignment",
      value: `${center.consensus_alignment}%`,
      tone: center.consensus_alignment < 45 ? "rose" : "sky",
    },
  ];

  return (
    <section className="positions-hero following-hero feed-top-signal mb-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 overflow-hidden relative">
      <div className="following-network-glow absolute inset-0 pointer-events-none" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-r from-violet-950/35 via-transparent to-teal-950/15 pointer-events-none" />
      <div className="relative px-3 py-3 sm:px-4 sm:py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <LiveDot color="violet" />
              <HeatPill tone="violet" pulse>
                Command center
              </HeatPill>
            </div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-white">
              Conviction Ledger
            </h1>
            <p className="text-[11px] sm:text-xs text-zinc-500 mt-1 max-w-xl">
              Public conviction archive · forecasting identity terminal · reputation exposure map
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
          {headline.map((s, i) => (
            <div
              key={s.label}
              className={`rounded-lg border bg-zinc-900/40 px-2.5 py-2 feed-hover-lift feed-stagger-${Math.min(i, 5)} ${TONE_BORDER[s.tone] ?? TONE_BORDER.violet}`}
            >
              <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5">{s.label}</p>
              <p className={`text-sm font-semibold tabular-nums truncate ${TONE_TEXT[s.tone] ?? "text-white"}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-3">
          {center.metrics.map((m) => (
            <div
              key={m.id}
              className={`rounded-lg border border-zinc-800/60 bg-zinc-950/50 px-2 py-1.5 ${TONE_BORDER[m.tone]}`}
            >
              <p className="text-[8px] text-zinc-600">{m.label}</p>
              <p className={`text-[11px] font-semibold tabular-nums ${TONE_TEXT[m.tone]}`}>{m.value}</p>
              <p className="text-[8px] text-zinc-700 truncate">{m.sub}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/80 px-2.5 py-2 overflow-hidden">
          <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-1.5">Live intelligence</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {center.intelligence.map((line) => (
              <p key={line.id} className={`text-[10px] ${TONE_TEXT[line.tone]} leading-snug`}>
                <span className="text-zinc-700 mr-1.5">▸</span>
                {line.text}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
