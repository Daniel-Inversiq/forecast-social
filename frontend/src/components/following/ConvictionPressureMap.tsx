"use client";

import { HeatPill } from "@/components/feed/shared";
import type { SectorPressure } from "./types";

const TONE_BAR: Record<SectorPressure["tone"], string> = {
  violet: "from-violet-600/80 to-violet-400/50",
  rose: "from-rose-600/70 to-rose-400/50",
  emerald: "from-emerald-600/70 to-emerald-400/50",
  sky: "from-sky-600/70 to-sky-400/50",
  amber: "from-amber-600/70 to-amber-400/50",
};

function Meter({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="flex justify-between gap-1 mb-0.5">
        <span className="text-[7px] uppercase tracking-wider text-zinc-600">{label}</span>
        <span className="text-[7px] tabular-nums text-zinc-500">{value}%</span>
      </div>
      <div className="h-1 rounded-full bg-zinc-800/90 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${
            warn ? "from-rose-600/80 to-amber-500/60" : "from-violet-600/70 to-violet-400/50"
          }`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}

export function ConvictionPressureMap({ sectors }: { sectors: SectorPressure[] }) {
  if (sectors.length === 0) return null;

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <HeatPill tone="amber">Map</HeatPill>
          <h2 className="text-[11px] font-semibold text-zinc-300">Conviction distribution</h2>
        </div>
        <span className="text-[9px] text-zinc-600">Sector shape · ideology</span>
      </div>
      <div className="space-y-3">
        {sectors.map((s) => (
          <div key={s.sector} className="rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-2">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[11px] font-semibold text-zinc-200">{s.sector}</span>
              <div
                className={`h-1 flex-1 max-w-[80px] rounded-full bg-gradient-to-r ${TONE_BAR[s.tone]} opacity-80`}
                style={{ width: `${Math.max(12, s.dominance)}%` }}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Meter label="Dominance" value={s.dominance} />
              <Meter label="Disagreement" value={s.disagreement} warn={s.disagreement >= 55} />
              <Meter label="Pressure" value={s.pressure} warn={s.pressure >= 65} />
              <Meter label="Alignment" value={s.alignment} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
