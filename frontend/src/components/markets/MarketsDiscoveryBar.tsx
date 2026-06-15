"use client";

import type { MarketSortKey, ResolutionHorizonFilterKey } from "./types";

const HORIZON_FILTERS: { key: ResolutionHorizonFilterKey | "all"; label: string }[] = [
  { key: "all", label: "All horizons" },
  { key: "resolves_soon", label: "Resolves soon" },
  { key: "this_week", label: "This week" },
  { key: "this_month", label: "This month" },
  { key: "long_term", label: "Long-term" },
  { key: "recently_resolved", label: "Resolved" },
];

const SORTS: { key: MarketSortKey; label: string }[] = [
  { key: "momentum", label: "Momentum" },
  { key: "contested", label: "Most contested" },
  { key: "agents", label: "Most agents" },
  { key: "shift", label: "Largest shift" },
  { key: "receipts", label: "Receipts" },
  { key: "probability", label: "Probability" },
];

export function MarketsDiscoveryBar({
  horizonFilter,
  onHorizonFilterChange,
  sort,
  onSortChange,
  query,
  onQueryChange,
  resultCount,
}: {
  horizonFilter: ResolutionHorizonFilterKey | "all";
  onHorizonFilterChange: (f: ResolutionHorizonFilterKey | "all") => void;
  sort: MarketSortKey;
  onSortChange: (s: MarketSortKey) => void;
  query: string;
  onQueryChange: (q: string) => void;
  resultCount: number;
}) {
  return (
    <div className="sticky top-[44px] sm:top-[48px] z-40 -mx-3 sm:-mx-5 lg:-mx-6 px-3 sm:px-5 lg:px-6 py-1.5 mb-2 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[120px] max-w-md">
            <svg
              className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                clipRule="evenodd"
              />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search markets…"
              className="w-full h-7 pl-7 pr-2 text-[11px] rounded-md bg-zinc-900/80 border border-zinc-800/90 text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as MarketSortKey)}
            className="h-7 text-[11px] rounded-md bg-zinc-900/80 border border-zinc-800/90 text-zinc-300 px-2 cursor-pointer focus:outline-none"
            aria-label="Sort markets"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-zinc-600 tabular-nums shrink-0">
            {resultCount} shown
          </span>
        </div>
        <div className="flex gap-1 overflow-x-auto feed-scroll-x scrollbar-none">
          {HORIZON_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onHorizonFilterChange(key)}
              className={`feed-chip-active shrink-0 px-2 py-0.5 text-[10px] rounded-full border transition whitespace-nowrap ${
                horizonFilter === key
                  ? "bg-zinc-100 text-zinc-950 border-zinc-100"
                  : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
