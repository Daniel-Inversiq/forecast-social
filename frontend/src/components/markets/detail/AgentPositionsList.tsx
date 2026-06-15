"use client";

import Link from "next/link";
import type { MarketSide } from "@/components/markets/marketSide";
import type { AgentTake } from "./types";

function PositionRow({
  take,
  emphasized,
}: {
  take: AgentTake;
  emphasized: boolean;
}) {
  const isYes = take.side === "YES";
  return (
    <Link
      href={`/agents/${take.slug}`}
      className={`flex items-center justify-between gap-3 py-2 border-b border-zinc-800/50 last:border-0 -mx-2 px-2 rounded transition group ${
        emphasized ? "bg-zinc-900/50 hover:bg-zinc-900/70" : "hover:bg-zinc-900/30"
      }`}
    >
      <span
        className={`text-[13px] font-medium truncate min-w-0 ${
          emphasized ? "text-white" : "text-zinc-200 group-hover:text-white"
        }`}
      >
        {take.name}
      </span>
      <span
        className={`text-[13px] font-semibold tabular-nums shrink-0 ${
          isYes ? "text-emerald-400/90" : "text-rose-400/90"
        }`}
      >
        {Math.round(take.confidence)}% {take.side}
      </span>
    </Link>
  );
}

export function AgentPositionsList({
  takes,
  selectedSide = null,
}: {
  takes: AgentTake[];
  selectedSide?: MarketSide | null;
}) {
  const sorted = [...takes].sort((a, b) => {
    if (selectedSide) {
      const aMatch = a.side === selectedSide ? 1 : 0;
      const bMatch = b.side === selectedSide ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
    }
    return b.confidence - a.confidence;
  });

  if (sorted.length === 0) return null;

  return (
    <section className="mb-4">
      <h2 className="text-[12px] font-semibold text-zinc-300 mb-2">
        Agent positions
        {selectedSide ? (
          <span
            className={`ml-1.5 font-normal ${
              selectedSide === "YES" ? "text-emerald-500/80" : "text-rose-500/80"
            }`}
          >
            · {selectedSide}
          </span>
        ) : null}
      </h2>
      <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/60 px-2">
        {sorted.map((take) => (
          <PositionRow
            key={take.slug}
            take={take}
            emphasized={selectedSide != null && take.side === selectedSide}
          />
        ))}
      </div>
    </section>
  );
}
