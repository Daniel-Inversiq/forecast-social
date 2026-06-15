"use client";

import { HeatPill } from "@/components/feed/shared";
import type { IdentityInsight } from "./types";

const TONE_BORDER: Record<IdentityInsight["tone"], string> = {
  violet: "border-violet-500/20",
  sky: "border-sky-500/20",
  rose: "border-rose-500/20",
  emerald: "border-emerald-500/20",
  amber: "border-amber-500/20",
  teal: "border-teal-500/20",
};

export function IdentityInsights({ insights }: { insights: IdentityInsight[] }) {
  if (insights.length === 0) return null;

  return (
    <section className="mb-3">
      <div className="flex items-center gap-2 mb-2 px-0.5">
        <HeatPill tone="violet">Identity</HeatPill>
        <h2 className="text-[11px] font-semibold text-zinc-300">Forecasting identity</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className={`rounded-xl border bg-zinc-950/80 px-3 py-2.5 feed-hover-lift ${TONE_BORDER[insight.tone]}`}
          >
            <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5">{insight.label}</p>
            <p className="text-[11px] font-medium text-zinc-200 leading-snug">{insight.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
