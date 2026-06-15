"use client";

import Link from "next/link";
import { isMarketResolved } from "@/lib/resolution";
import type { EnrichedMarketDetail } from "./types";

const KIND_LABEL: Record<string, { label: string; legendary?: boolean }> = {
  first_mover: { label: "First signal", legendary: true },
  flip: { label: "Famous flip", legendary: true },
  battle: { label: "Battle escalation" },
  verified: { label: "Verified call", legendary: true },
  hold: { label: "Faction formation" },
  settlement: { label: "Aftermath", legendary: true },
};

export function MarketMemoryPanel({ market }: { market: EnrichedMarketDetail }) {
  const memory = market.enriched.market_memory;
  const resolved = isMarketResolved(market);
  if (memory.length === 0) return null;

  return (
    <section
      className={`rounded-xl border p-4 sm:p-5 mb-4 ${
        resolved
          ? "border-emerald-800/30 bg-emerald-950/5 war-room-archival"
          : "border-zinc-800/70 bg-zinc-950/90"
      }`}
    >
      <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-600">Institutional memory</p>
      <h2 className="text-base font-semibold text-zinc-100 mt-0.5 mb-1">Market timeline</h2>
      <p className="text-[10px] text-zinc-600 mb-4">
        {resolved
          ? "Permanent archive — legendary moments, reputation migrations, and settlement memory."
          : "Who moved what, when — the conviction war as it unfolded."}
      </p>

      <ol className="relative border-l border-zinc-800/70 ml-2.5 space-y-4">
        {memory.map((entry, i) => {
          const meta = KIND_LABEL[entry.kind] ?? { label: entry.kind };
          return (
            <li key={entry.id} className="pl-5 relative">
              <span
                className={`absolute -left-[5px] top-2 h-2.5 w-2.5 rounded-full ring-2 ring-zinc-950 ${
                  meta.legendary ? "bg-amber-500/90" : "bg-violet-500/70"
                }`}
              />
              <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5">
                {meta.label}
                {i === 0 ? " · earliest" : ""}
                {meta.legendary ? " · legendary" : ""}
              </p>
              <p
                className={`text-[11px] leading-snug ${
                  meta.legendary ? "text-zinc-200 font-medium" : "text-zinc-400"
                }`}
              >
                {entry.text}
              </p>
            </li>
          );
        })}
      </ol>

      {market.why_moving.first_movers.length > 0 && (
        <div className="mt-4 pt-4 border-t border-zinc-800/50">
          <p className="text-[9px] uppercase text-zinc-600 mb-2">Verified first movers · timing edge</p>
          <div className="flex flex-wrap gap-1.5">
            {market.why_moving.first_movers.slice(0, 4).map((m) => (
              <Link
                key={m.slug}
                href={`/agents/${m.slug}`}
                className="text-[9px] px-2 py-1 rounded-md border border-zinc-800/80 text-zinc-500 hover:text-violet-300 hover:border-violet-500/30 bg-zinc-900/40 transition"
              >
                {m.name} · {m.reputation_score} rep · {m.tier_label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
