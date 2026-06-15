"use client";

import Link from "next/link";
import { RANK_ORDER, buildRankProgress } from "./rankProgress";
import type { EnrichedUserProfile } from "@/components/users/profile/types";
import type { ScryReceipt } from "./types";
import { TrustedStatusExplainer } from "./TrustedStatusExplainer";
import { TrustDistributionTagline } from "@/components/trust/TrustDistributionTagline";

function ProgressBar({
  label,
  current,
  required,
  suffix,
}: {
  label: string;
  current: number;
  required: number;
  suffix?: string;
}) {
  const pct = Math.min(100, Math.round((current / required) * 100));
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-zinc-500">{label}</span>
        <span className="text-zinc-300 tabular-nums">
          {current} / {required}
          {suffix ?? ""}
        </span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-600/90 to-cyan-500/70 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function RankProgression({
  profile,
  receipts,
}: {
  profile: EnrichedUserProfile;
  receipts: ScryReceipt[];
}) {
  const progress = buildRankProgress(profile, receipts);
  const currentIdx = RANK_ORDER.findIndex((r) => r.key === progress.currentRank);

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 overflow-hidden">
      <div className="px-3 sm:px-4 py-3 border-b border-zinc-800/60 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">Forecasting rank</h3>
          <TrustDistributionTagline className="mt-0.5" compact />
        </div>
        <Link
          href="/benchmark"
          className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-violet-300/90 hover:text-violet-200 border border-violet-500/25 bg-violet-500/10 px-2.5 py-1 rounded-full transition"
        >
          Benchmark →
        </Link>
      </div>

      <div className="px-3 sm:px-4 py-3">
        <div className="flex flex-wrap gap-1 mb-3">
          {RANK_ORDER.map((rank, i) => {
            const active = i === currentIdx;
            const passed = i < currentIdx;
            return (
              <span
                key={rank.key}
                className={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${
                  active
                    ? "border-violet-400/50 bg-violet-500/15 text-violet-200 font-semibold"
                    : passed
                      ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-400/80"
                      : "border-zinc-800 text-zinc-600"
                }`}
              >
                {rank.label}
              </span>
            );
          })}
        </div>

        <p className="text-[10px] text-zinc-600 mb-0.5">Current rank</p>
        <p className="text-lg font-semibold text-white mb-3">{progress.currentLabel}</p>

        {progress.nextLabel && (
          <>
            <p className="text-[10px] text-zinc-500 mb-2">
              Progress to {progress.nextLabel}
            </p>
            <div className="space-y-2.5 mb-3">
              <ProgressBar
                label="Resolved calls"
                current={progress.resolvedCalls.current}
                required={progress.resolvedCalls.required}
              />
              <ProgressBar
                label="Credibility"
                current={progress.credibility.current}
                required={progress.credibility.required}
              />
              <p className="text-[10px] text-zinc-500">
                Abuse flags:{" "}
                <span className="text-emerald-400/90 font-medium tabular-nums">
                  {progress.abuseFlags}
                </span>
                <span className="text-zinc-600"> (clean participation)</span>
              </p>
              <ProgressBar
                label="Account age"
                current={progress.accountAgeDays.current}
                required={progress.accountAgeDays.required}
                suffix=" days"
              />
              <p className="text-[9px] text-zinc-600">
                Calibration trend:{" "}
                <span
                  className={
                    progress.calibrationTrendPositive ? "text-emerald-400/90" : "text-amber-400/90"
                  }
                >
                  {progress.calibrationTrendPositive ? "positive" : "building"}
                </span>
              </p>
            </div>

            {progress.unlocks.length > 0 && (
              <div className="mb-3 rounded-lg border border-violet-500/15 bg-violet-950/20 px-2.5 py-2">
                <p className="text-[9px] uppercase tracking-wider text-violet-400/70 mb-1.5">
                  {progress.nextLabel} unlocks
                </p>
                <ul className="space-y-1">
                  {progress.unlocks.map((u) => (
                    <li key={u} className="text-[10px] text-zinc-400 flex gap-1.5">
                      <span className="text-violet-400">→</span>
                      {u}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <TrustedStatusExplainer />
      </div>
    </section>
  );
}
