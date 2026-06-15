"use client";

import type { NarrativeFilterKey, NarrativeSortKey } from "./types";

const FILTERS: { key: NarrativeFilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "macro", label: "Macro" },
  { key: "politics", label: "Politics" },
  { key: "crypto", label: "Crypto" },
  { key: "ai", label: "AI" },
  { key: "sports", label: "Sports" },
  { key: "climate", label: "Climate" },
  { key: "tech", label: "Tech" },
  { key: "markets", label: "Markets" },
  { key: "forming", label: "Forming" },
  { key: "contrarian", label: "Contrarian" },
];

const SORTS: { key: NarrativeSortKey; label: string }[] = [
  { key: "pressure", label: "Pressure" },
  { key: "acceleration", label: "Acceleration" },
  { key: "coordination", label: "Coordination" },
  { key: "rep_weight", label: "Rep weight" },
  { key: "earliest", label: "Earliest" },
  { key: "lifecycle", label: "Lifecycle" },
];

export function NarrativesFilterBar({
  filter,
  onFilterChange,
  sort,
  onSortChange,
  query,
  onQueryChange,
  resultCount,
}: {
  filter: NarrativeFilterKey;
  onFilterChange: (f: NarrativeFilterKey) => void;
  sort: NarrativeSortKey;
  onSortChange: (s: NarrativeSortKey) => void;
  query: string;
  onQueryChange: (q: string) => void;
  resultCount: number;
}) {
  return (
    <div className="sticky top-[44px] sm:top-[48px] z-40 -mx-3 sm:-mx-5 lg:-mx-6 px-3 sm:px-5 lg:px-6 py-2 mb-3 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[140px] max-w-md">
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
              placeholder="Search narratives, agents, markets…"
              className="w-full h-8 pl-8 pr-3 text-[11px] rounded-lg bg-zinc-900/80 border border-zinc-800/90 text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-sky-500/40 focus:ring-1 focus:ring-sky-500/20"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as NarrativeSortKey)}
            className="h-8 text-[11px] rounded-lg bg-zinc-900/80 border border-zinc-800/90 text-zinc-300 px-2 cursor-pointer focus:outline-none focus:border-sky-500/40"
            aria-label="Sort narratives"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-zinc-600 tabular-nums shrink-0 ml-auto">
            {resultCount} signals
          </span>
        </div>
        <div className="flex gap-1 overflow-x-auto feed-scroll-x scrollbar-none pb-0.5">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onFilterChange(key)}
              className={`feed-chip-active shrink-0 px-2.5 py-1 text-[11px] rounded-full border transition whitespace-nowrap ${
                filter === key
                  ? "bg-gradient-to-r from-sky-500/90 to-violet-500/90 text-white border-transparent"
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
