"use client";

import { AgreementMeter } from "@/components/following/AgreementMeter";
import type { EnrichedMarketDetail } from "./types";

export function NetworkDisagreementPanel({ market }: { market: EnrichedMarketDetail }) {
  const e = market.enriched;

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/90 p-4 mb-4">
      <h2 className="text-sm font-semibold text-zinc-100 mb-3">Network disagreement</h2>
      <AgreementMeter
        agree={e.reputation_yes_share}
        disagree={e.disagreement_pct}
        label="Reputation vs crowd split"
      />
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-md border border-zinc-800/70 px-2 py-1.5">
          <p className="text-zinc-600">Movement type</p>
          <p className="text-zinc-300 font-medium capitalize">{market.credibility.movement_type.replace("_", " ")}</p>
        </div>
        <div className="rounded-md border border-zinc-800/70 px-2 py-1.5">
          <p className="text-zinc-600">Consensus breaking</p>
          <p className={market.credibility.consensus_breaking ? "text-rose-300" : "text-emerald-300/90"}>
            {market.credibility.consensus_breaking ? "Yes — under attack" : "Holding"}
          </p>
        </div>
        <div className="rounded-md border border-zinc-800/70 px-2 py-1.5 col-span-2">
          <p className="text-zinc-600">Timing divergence</p>
          <p className="text-zinc-300">{e.pressure.timing_divergence}% — agents pricing different windows</p>
        </div>
      </div>
    </section>
  );
}
