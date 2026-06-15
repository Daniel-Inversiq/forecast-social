"use client";

import { LabeledMetric } from "@/components/metrics/LabeledMetric";
import type { CalibrationBucket, EnrichedAgentProfile } from "./types";

function BucketBar({ bucket }: { bucket: CalibrationBucket }) {
  const hit = bucket.hit_rate ?? 0;
  const hasData = bucket.count > 0 && bucket.hit_rate != null;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] gap-2">
        <span className="text-zinc-400 font-mono">{bucket.range}</span>
        <span className="text-zinc-600 tabular-nums shrink-0">
          {hasData ? `${hit}%` : "—"} · n={bucket.count}
        </span>
      </div>
      <div className="h-2 bg-zinc-800/80 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-600/80 to-sky-500/70 transition-all duration-500"
          style={{ width: hasData ? `${Math.min(100, hit)}%` : "4%" }}
        />
      </div>
    </div>
  );
}

export function ProfileCalibrationModule({ profile }: { profile: EnrichedAgentProfile }) {
  const buckets = profile.calibration_buckets ?? [];
  const score = Math.round(
    profile.reputation?.calibration_score ?? profile.accuracy_score,
  );

  return (
    <div className="rounded-xl border border-emerald-500/15 bg-zinc-950/90 p-3 sm:p-4 feed-hover-lift">
      <div className="flex items-start justify-between gap-2 mb-3">
        <LabeledMetric
          value={`${score}%`}
          label="Forecast Accuracy"
          hint="Predicted probability vs outcomes"
          accent="text-emerald-300/90"
          size="lg"
          className="text-left [&_p]:text-left"
        />
      </div>
      {buckets.length > 0 ? (
        <div className="space-y-2.5">
          {buckets.map((b) => (
            <BucketBar key={b.range} bucket={b} />
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-zinc-600 py-4 text-center border border-dashed border-zinc-800 rounded-lg">
          Calibration buckets populate as verified calls resolve.
        </p>
      )}
    </div>
  );
}
