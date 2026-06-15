"use client";

import Link from "next/link";
import { buildPremiumMarketIntel } from "@/lib/intelligencePremium";
import type { EnrichedMarketDetail } from "@/components/markets/detail/types";
import { IntelligenceDeskShell } from "../IntelligenceDeskShell";

export function MarketPremiumLayer({ market }: { market: EnrichedMarketDetail }) {
  const intel = buildPremiumMarketIntel(market);

  return (
    <IntelligenceDeskShell
      title="Market intelligence desk"
      subtitle="Faction stability · hidden pressure · verification pathway"
    >
      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-2.5">
          <p className="text-[9px] text-zinc-600 uppercase tracking-wider">Faction stability</p>
          <p className="text-lg font-semibold text-amber-200/90 tabular-nums mt-0.5">
            {intel.factionStability}
          </p>
          <p className="text-[9px] text-zinc-600 mt-1">Coalition fracture risk {intel.coalitionFractureRisk}%</p>
        </div>
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-2.5">
          <p className="text-[9px] text-zinc-600 uppercase tracking-wider">Hidden pressure</p>
          <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed line-clamp-3">{intel.hiddenPressure}</p>
        </div>
      </div>

      <p className="text-[10px] text-zinc-500 mb-2 leading-relaxed">{intel.verificationPathway}</p>

      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-[9px] uppercase tracking-wider text-emerald-500/70 mb-1.5">Likely rep gainers</p>
          <ul className="space-y-1">
            {intel.reputationWinners.map((w) => (
              <li key={w.slug} className="text-[10px]">
                <Link href={`/agents/${w.slug}`} className="text-zinc-300 hover:text-emerald-300/90">
                  {w.name}
                </Link>
                <span className="text-zinc-600"> — {w.reason}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider text-rose-500/70 mb-1.5">Likely rep losers</p>
          <ul className="space-y-1">
            {intel.reputationLosers.map((l) => (
              <li key={l.slug} className="text-[10px]">
                <Link href={`/agents/${l.slug}`} className="text-zinc-300 hover:text-rose-300/90">
                  {l.name}
                </Link>
                <span className="text-zinc-600"> — {l.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-1.5">Historical analog markets</p>
      <div className="flex flex-wrap gap-1.5">
        {intel.analogMarkets.map((m) => (
          <Link
            key={m.slug}
            href={`/markets/${m.slug}`}
            className="text-[10px] px-2 py-1 rounded-md border border-zinc-800 text-zinc-400 hover:border-amber-500/25 hover:text-amber-200/90 transition"
          >
            {m.title} · {m.similarity}% match
          </Link>
        ))}
      </div>
    </IntelligenceDeskShell>
  );
}
