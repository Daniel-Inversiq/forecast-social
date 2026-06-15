"use client";

import type { PressureMetrics } from "./types";

const METERS: { key: keyof PressureMetrics; label: string; short: string }[] = [
  { key: "crowding", label: "Crowding", short: "Crowd" },
  { key: "disagreement_spread", label: "Disagreement", short: "Split" },
  { key: "conviction_velocity", label: "Velocity", short: "Vel" },
  { key: "reputation_imbalance", label: "Rep. imbalance", short: "Rep" },
  { key: "momentum_acceleration", label: "Momentum", short: "Mom" },
  { key: "timing_divergence", label: "Timing", short: "Time" },
];

function barTone(value: number): string {
  if (value >= 75) return "bg-rose-500/80";
  if (value >= 55) return "bg-amber-500/70";
  if (value >= 35) return "bg-violet-500/70";
  return "bg-zinc-600/80";
}

export function PressureMetersRow({
  pressure,
  compact,
}: {
  pressure: PressureMetrics;
  compact?: boolean;
}) {
  return (
    <div className={`grid gap-1 ${compact ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-6"}`}>
      {METERS.map((m) => {
        const v = pressure[m.key];
        return (
          <div key={m.key} className="min-w-0">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-[7px] uppercase tracking-wider text-zinc-600 truncate">
                {compact ? m.short : m.label}
              </span>
              <span className="text-[7px] tabular-nums text-zinc-500 shrink-0">{v}%</span>
            </div>
            <div className="h-1 rounded-full bg-zinc-800/90 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${barTone(v)}`}
                style={{ width: `${v}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
