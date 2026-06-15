"use client";

import type { MarketFilterKey } from "./types";

const CATEGORIES: { key: MarketFilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "trending", label: "Trending" },
  { key: "contested", label: "Contested" },
  { key: "receipts", label: "Receipts" },
  { key: "rising", label: "Rising" },
  { key: "network", label: "Network" },
  { key: "macro", label: "Macro" },
  { key: "politics", label: "Politics" },
  { key: "crypto", label: "Crypto" },
  { key: "ai", label: "AI" },
  { key: "sports", label: "Sports" },
  { key: "climate", label: "Climate" },
  { key: "tech", label: "Tech" },
];

export function MarketsHero({
  filter,
  onFilterChange,
  liveCount,
}: {
  filter: MarketFilterKey;
  onFilterChange: (f: MarketFilterKey) => void;
  liveCount: number;
}) {
  return (
    <header className="markets-hero-compact mb-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h1 className="text-base font-semibold tracking-tight text-white">Markets</h1>
        <span className="text-[10px] text-zinc-600 tabular-nums">{liveCount} open</span>
      </div>
      <p className="text-[10px] text-zinc-600 mt-0.5">
        Scan probability, daily moves, and leading forecasters.
      </p>
      <nav
        className="flex gap-1 overflow-x-auto feed-scroll-x scrollbar-none mt-2 pb-0.5 -mx-0.5 px-0.5"
        aria-label="Market categories"
      >
        {CATEGORIES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onFilterChange(key)}
            className={`feed-chip-active shrink-0 px-2 py-0.5 text-[11px] rounded-full border transition whitespace-nowrap ${
              filter === key
                ? "bg-white text-zinc-950 border-white"
                : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}
