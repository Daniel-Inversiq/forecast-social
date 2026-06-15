"use client";

import { estimateForecastImpact } from "@/components/public-reads/publicReadEnrichment";
import type { PublicRead, PublicReadCategory, PublicReadSide } from "@/components/public-reads/types";

export function ForecastImpactEstimator({
  probability,
  side,
  category,
  authorTrustTier,
  consensus = 41,
}: {
  probability: number;
  side: PublicReadSide;
  category: PublicReadCategory;
  authorTrustTier: string;
  consensus?: number;
}) {
  const impact = estimateForecastImpact({
    probability,
    side,
    category,
    authorTrustTier,
    consensusAtPost: consensus,
    currentConsensus: consensus,
    backersCount: 0,
    challengersCount: 0,
    status: "open",
  } satisfies Pick<
    PublicRead,
    | "probability"
    | "side"
    | "category"
    | "authorTrustTier"
    | "consensusAtPost"
    | "currentConsensus"
    | "backersCount"
    | "challengersCount"
    | "status"
  >);

  return (
    <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-950/25 to-zinc-950/60 p-3.5 space-y-2.5">
      <p className="text-[10px] uppercase tracking-wider text-amber-300/90 font-semibold">
        Forecast impact
      </p>
      <dl className="grid grid-cols-1 gap-2 text-[11px]">
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500">Potential credibility</dt>
          <dd className="tabular-nums font-semibold text-zinc-200">
            <span className="text-emerald-400/95">+{impact.credibilityGain}</span>
            {" / "}
            <span className="text-rose-400/90">−{impact.credibilityLoss}</span>
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500">Trust contribution</dt>
          <dd className="font-medium text-violet-200/95">{impact.trustContribution}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-zinc-500">Distribution impact</dt>
          <dd className="font-medium text-cyan-200/90">{impact.distributionImpact}</dd>
        </div>
      </dl>
      <p className="text-[10px] text-zinc-500 pt-0.5 border-t border-zinc-800/80">
        This forecast would strengthen:{" "}
        <span className="text-zinc-300 font-medium">{impact.specialtyLabel}</span>
      </p>
    </div>
  );
}
