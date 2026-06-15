"use client";

import { HeatPill } from "@/components/feed/shared";
import type { NarrativeExposureRow } from "./types";

const ALIGN_LABEL: Record<NarrativeExposureRow["alignment"], string> = {
  aligned: "Aligned",
  isolated: "Isolated",
  mixed: "Mixed",
};

const VOL_LABEL: Record<NarrativeExposureRow["volatility"], string> = {
  stable: "Stable",
  volatile: "Volatile",
};

const TONE_BAR: Record<NarrativeExposureRow["tone"], string> = {
  violet: "from-violet-500/80 to-violet-400/50",
  amber: "from-amber-500/80 to-amber-400/50",
  rose: "from-rose-500/80 to-rose-400/50",
  sky: "from-sky-500/80 to-sky-400/50",
  emerald: "from-emerald-500/80 to-emerald-400/50",
  teal: "from-teal-500/80 to-teal-400/50",
};

export function NarrativeExposurePanel({
  rows,
  identityLine,
}: {
  rows: NarrativeExposureRow[];
  identityLine: string;
}) {
  if (rows.length === 0) return null;

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 overflow-hidden mb-4">
      <div className="px-3 py-2.5 border-b border-zinc-800/70 bg-gradient-to-r from-teal-950/25 to-zinc-950">
        <div className="flex items-center gap-2 mb-1">
          <HeatPill tone="teal">Exposure</HeatPill>
          <h2 className="text-[11px] font-semibold text-zinc-200">Narrative exposure</h2>
        </div>
        <p className="text-[10px] text-violet-300/90 leading-relaxed">{identityLine}</p>
      </div>
      <div className="p-3 space-y-2.5">
        {rows.map((row) => (
          <div key={row.cluster}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[10px] font-medium text-zinc-300">{row.cluster}</span>
              <div className="flex items-center gap-2 text-[8px]">
                <span
                  className={
                    row.alignment === "isolated"
                      ? "text-amber-400"
                      : row.alignment === "aligned"
                        ? "text-emerald-400"
                        : "text-zinc-500"
                  }
                >
                  {ALIGN_LABEL[row.alignment]}
                </span>
                <span className="text-zinc-700">·</span>
                <span className={row.volatility === "volatile" ? "text-rose-400/90" : "text-zinc-600"}>
                  {VOL_LABEL[row.volatility]}
                </span>
                <span className="text-violet-300 tabular-nums font-semibold">{row.exposure_pct}%</span>
              </div>
            </div>
            <div className="h-1 rounded-full bg-zinc-800/90 overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${TONE_BAR[row.tone]}`}
                style={{ width: `${Math.max(8, row.exposure_pct)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
