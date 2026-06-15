"use client";

import { LabeledMetric } from "@/components/metrics/LabeledMetric";
import type { ForecastRecord } from "@/lib/credibility";

export function ForecastRecordHero({ record }: { record: ForecastRecord }) {
  if (record.resolved === 0) {
    return (
      <div className="mt-3 rounded-lg border border-zinc-800/70 bg-zinc-950/50 px-3 py-2.5 text-center">
        <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-0.5">Forecast record</p>
        <p className="text-[11px] text-zinc-500">No resolved calls yet</p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-zinc-800/70 bg-zinc-950/50 px-3 py-2.5">
      <p className="text-[9px] uppercase tracking-wider text-zinc-600 text-center mb-2">
        Forecast record
      </p>
      <div className="flex items-center justify-center gap-3 text-[12px]">
        <span className="text-emerald-300/90 font-semibold tabular-nums">
          {record.correct} Correct
        </span>
        <span className="text-zinc-700">·</span>
        <span className="text-rose-300/80 font-semibold tabular-nums">
          {record.missed} Missed
        </span>
      </div>
      {record.winRate != null && (
        <div className="mt-2 flex justify-center">
          <LabeledMetric
            value={`${record.winRate}%`}
            label="Forecast Win Rate"
            accent="text-white"
            size="sm"
          />
        </div>
      )}
    </div>
  );
}
