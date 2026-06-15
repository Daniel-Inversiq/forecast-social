"use client";

import type { VerifiedCallFilterKey, VerifiedCallSortKey } from "./types";

const FILTERS: { key: VerifiedCallFilterKey; label: string }[] = [
  { key: "all", label: "All receipts" },
  { key: "today", label: "Verified today" },
  { key: "legendary", label: "Legendary" },
  { key: "contrarian", label: "Contrarian" },
  { key: "high_conviction", label: "High conviction" },
  { key: "most_isolated", label: "Most isolated" },
  { key: "fastest_repricing", label: "Fastest repricing" },
  { key: "before_consensus", label: "Before consensus" },
  { key: "seasonal", label: "Seasonal" },
  { key: "coalition", label: "Coalition-driven" },
  { key: "narrative_defining", label: "Narrative defining" },
];

const SORTS: { key: VerifiedCallSortKey; label: string }[] = [
  { key: "recent", label: "Most recent" },
  { key: "timing_edge", label: "Strongest timing" },
  { key: "isolation", label: "Most isolated" },
  { key: "reputation", label: "Reputation impact" },
  { key: "days_early", label: "Days before repricing" },
  { key: "conviction", label: "Highest conviction" },
  { key: "contested", label: "Most contested" },
];

export function VerifiedCallsFilterBar({
  filter,
  onFilterChange,
  sort,
  onSortChange,
  query,
  onQueryChange,
  resultCount,
}: {
  filter: VerifiedCallFilterKey;
  onFilterChange: (f: VerifiedCallFilterKey) => void;
  sort: VerifiedCallSortKey;
  onSortChange: (s: VerifiedCallSortKey) => void;
  query: string;
  onQueryChange: (q: string) => void;
  resultCount: number;
}) {
  return (
    <div className="sticky top-[44px] sm:top-[48px] z-40 -mx-3 sm:-mx-5 lg:-mx-6 px-3 sm:px-5 lg:px-6 py-2.5 mb-3 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md">
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[160px] max-w-md">
            <svg
              className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600"
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
              placeholder="Narratives, agents, seasons, markets, rivalries…"
              className="w-full h-8 pl-8 pr-3 text-[11px] rounded-lg bg-zinc-900/80 border border-zinc-800/90 text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/35 focus:ring-1 focus:ring-amber-500/15"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as VerifiedCallSortKey)}
            className="h-8 text-[11px] rounded-lg bg-zinc-900/80 border border-zinc-800/90 text-zinc-300 px-2 cursor-pointer focus:outline-none focus:border-amber-500/35"
            aria-label="Sort verification archive"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-zinc-600 tabular-nums shrink-0">
            {resultCount} receipts
          </span>
        </div>
        <div className="flex gap-1 overflow-x-auto feed-scroll-x scrollbar-none pb-0.5">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onFilterChange(key)}
              className={`shrink-0 px-2.5 py-1 text-[11px] rounded-full border transition whitespace-nowrap ${
                filter === key
                  ? "bg-amber-950/60 text-amber-100/95 border-amber-500/35"
                  : "border-zinc-800/90 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
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
