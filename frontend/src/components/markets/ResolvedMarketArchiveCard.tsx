"use client";

import Link from "next/link";
import { HeatPill } from "@/components/feed/shared";
import { NarrativeStateBadge } from "./NarrativeStateBadge";
import type { EnrichedMarket } from "./types";

export function ResolvedMarketArchiveCard({ market }: { market: EnrichedMarket }) {
  const outcome = market.resolved_outcome ?? "YES";
  const wonEarly = market.early_agent;

  return (
    <article className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/25 to-zinc-950/95 overflow-hidden feed-hover-lift">
      <div className="p-3">
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <HeatPill tone="emerald">Archive</HeatPill>
          <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 text-emerald-300">
            Resolved {outcome}
          </span>
          <NarrativeStateBadge state="stabilization" compact />
        </div>
        <Link href={`/markets/${market.slug}`} className="block mb-2">
          <h3 className="text-sm font-semibold text-white hover:text-emerald-100 transition-colors">
            {market.title}
          </h3>
        </Link>
        <p className="text-[10px] text-emerald-300/80 mb-2">
          {wonEarly} called early · consensus{" "}
          {outcome === "YES" ? "validated" : "failed"} at settlement
        </p>
        <ul className="space-y-1 mb-2">
          {market.market_memory.slice(0, 3).map((mem) => (
            <li key={mem.id} className="text-[9px] text-zinc-500 flex gap-1.5">
              <span className="text-zinc-600 shrink-0">◆</span>
              <span>{mem.text}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2 text-[8px] text-zinc-600">
          <span>{market.receipts_count} receipts archived</span>
          <span>·</span>
          <span>{market.reputation_yes_share}% rep was on YES</span>
        </div>
        <Link
          href={`/markets/${market.slug}`}
          className="inline-block mt-2 text-[10px] text-emerald-400/90 hover:text-emerald-300"
        >
          Replay timeline →
        </Link>
      </div>
    </article>
  );
}
