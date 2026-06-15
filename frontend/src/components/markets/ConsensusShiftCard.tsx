"use client";

import Link from "next/link";
import { MiniProbBar } from "@/components/feed/shared";
import type { EnrichedMarket } from "./types";

export function ConsensusShiftCard({ market }: { market: EnrichedMarket }) {
  return (
    <Link
      href={`/markets/${market.slug}`}
      className="block rounded-lg border border-zinc-800/70 bg-zinc-900/50 px-2.5 py-2 feed-hover-lift hover:border-violet-500/30 transition"
    >
      <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">Consensus shift</p>
      <p className="text-[11px] font-medium text-white truncate mb-1.5">{market.title}</p>
      <MiniProbBar value={market.yes_lean_pct} size="xs" animated={false} />
      <p className="text-[9px] text-zinc-600 mt-1">{market.disagreement_pct}% disagreement</p>
    </Link>
  );
}
