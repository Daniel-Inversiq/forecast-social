"use client";

import Link from "next/link";
import { buildOpenFronts } from "./battleEnrichment";
import type { EnrichedBattle } from "./types";

export function OpenFrontsStrip({
  battles,
  activeSlug,
  onSelect,
}: {
  battles: EnrichedBattle[];
  activeSlug: string | null;
  onSelect: (marketSlug: string | null) => void;
}) {
  const fronts = buildOpenFronts(battles);
  if (fronts.length === 0) return null;

  return (
    <section className="mb-2">
      <div className="flex items-baseline gap-2 mb-1.5 px-0.5">
        <h2 className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
          Open fronts
        </h2>
        <span className="text-[9px] text-zinc-700">Narratives · filter clashes below</span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 feed-scroll-x scrollbar-none -mx-0.5 px-0.5">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`shrink-0 px-2.5 py-1 rounded-full border text-[10px] transition ${
            activeSlug === null
              ? "border-zinc-600 bg-zinc-800/80 text-zinc-200"
              : "border-zinc-800/80 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400"
          }`}
        >
          All
        </button>
        {fronts.map((front) => {
          const active = activeSlug === front.market_slug;
          return (
            <button
              key={front.id}
              type="button"
              onClick={() => onSelect(active ? null : front.market_slug)}
              className={`shrink-0 px-2.5 py-1 rounded-full border text-[10px] font-medium transition ${
                active
                  ? "border-zinc-600 bg-zinc-800/80 text-zinc-200"
                  : "border-zinc-800/60 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400"
              }`}
              title={front.market_title}
            >
              {front.label}
              {front.battle_count > 1 && (
                <span className="ml-1 text-zinc-600 tabular-nums">{front.battle_count}</span>
              )}
            </button>
          );
        })}
        <Link
          href="/markets"
          className="shrink-0 px-2 py-1 text-[9px] text-zinc-700 hover:text-zinc-500 self-center"
        >
          Markets →
        </Link>
      </div>
    </section>
  );
}
