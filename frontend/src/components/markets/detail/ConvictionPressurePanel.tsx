"use client";

import { PressureMetersRow } from "@/components/markets/PressureMetersRow";
import type { EnrichedMarketDetail } from "./types";

const TONE_TEXT: Record<string, string> = {
  violet: "text-violet-300/90",
  rose: "text-rose-300/90",
  amber: "text-amber-300/90",
  emerald: "text-emerald-300/90",
  zinc: "text-zinc-400",
};

const TONE_BORDER: Record<string, string> = {
  violet: "border-violet-500/20 bg-violet-950/20",
  rose: "border-rose-500/20 bg-rose-950/20",
  amber: "border-amber-500/20 bg-amber-950/15",
  emerald: "border-emerald-500/20 bg-emerald-950/15",
  zinc: "border-zinc-800/70 bg-zinc-900/40",
};

export function ConvictionPressurePanel({ market }: { market: EnrichedMarketDetail }) {
  const e = market.enriched;
  const pressureAccel =
    e.pressure.momentum_acceleration >= 65
      ? "Pressure accelerating"
      : e.pressure.disagreement_spread >= 45
        ? "Disagreement widening"
        : "Compression phase";

  return (
    <section className="rounded-xl border border-zinc-800/70 bg-zinc-950/90 p-4 sm:p-5 mb-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-600 mb-1">
            Network signal
          </p>
          <h2 className="text-base sm:text-lg font-semibold text-zinc-100">Conviction pressure</h2>
          <p className="text-[11px] text-zinc-500 mt-1 max-w-xl">{e.pressure_headline}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] uppercase text-zinc-600">Pressure state</p>
          <p className="text-sm font-semibold text-amber-300/90 tabular-nums">{pressureAccel}</p>
        </div>
      </div>

      <PressureMetersRow pressure={e.pressure} />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-4">
        {market.pressure_insights.map((insight) => (
          <div
            key={insight.label}
            className={`rounded-lg border px-3 py-2.5 ${TONE_BORDER[insight.tone]}`}
          >
            <p className="text-[8px] uppercase tracking-wider text-zinc-600">{insight.label}</p>
            <p className={`text-[11px] font-medium mt-1 leading-snug ${TONE_TEXT[insight.tone]}`}>
              {insight.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-zinc-800/50 grid grid-cols-3 gap-3">
        {[
          { label: "Conviction velocity", value: `${market.conviction_velocity}%` },
          { label: "Timing divergence", value: `${e.pressure.timing_divergence}%` },
          { label: "Volatility concentration", value: `${market.volatility === "high" ? "Elevated" : market.volatility === "medium" ? "Moderate" : "Low"}` },
        ].map((row) => (
          <div key={row.label}>
            <p className="text-[8px] uppercase text-zinc-600">{row.label}</p>
            <p className="text-sm font-semibold text-zinc-200 tabular-nums mt-0.5">{row.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
