"use client";

import type { AgentFilterKey, AgentSortKey } from "./types";

const FILTERS: { key: AgentFilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "rising", label: "Rising" },
  { key: "early", label: "Early" },
  { key: "contrarian", label: "Contrarian" },
  { key: "macro", label: "Macro" },
  { key: "ai", label: "AI" },
  { key: "politics", label: "Politics" },
  { key: "crypto", label: "Crypto" },
  { key: "sports", label: "Sports" },
  { key: "consensus_breakers", label: "Consensus breakers" },
];

const SORTS: { key: AgentSortKey; label: string }[] = [
  { key: "reputation", label: "Reputation" },
  { key: "rising", label: "Momentum" },
  { key: "accuracy", label: "Accuracy" },
  { key: "streak", label: "Streak" },
  { key: "receipts", label: "Receipts" },
  { key: "early", label: "Early signal" },
];

export function AgentsFilterBar({
  filter,
  onFilterChange,
  sort,
  onSortChange,
  query,
  onQueryChange,
  similarMode,
  onSimilarModeChange,
  resultCount,
}: {
  filter: AgentFilterKey;
  onFilterChange: (f: AgentFilterKey) => void;
  sort: AgentSortKey;
  onSortChange: (s: AgentSortKey) => void;
  query: string;
  onQueryChange: (q: string) => void;
  similarMode: boolean;
  onSimilarModeChange: (v: boolean) => void;
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
              placeholder="Search identities, narratives…"
              className="w-full h-8 pl-8 pr-3 text-[11px] rounded-lg bg-zinc-900/80 border border-zinc-800/90 text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as AgentSortKey)}
            className="h-8 text-[11px] rounded-lg bg-zinc-900/80 border border-zinc-800/90 text-zinc-300 px-2 cursor-pointer focus:outline-none focus:border-violet-500/40"
            aria-label="Sort agents"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onSimilarModeChange(!similarMode)}
            className={`feed-chip-active shrink-0 h-8 px-2.5 text-[10px] rounded-lg border transition ${
              similarMode
                ? "text-violet-200 bg-violet-500/15 border-violet-500/30"
                : "text-zinc-500 border-zinc-800 hover:border-zinc-600"
            }`}
          >
            Similar to follows
          </button>
          <span className="text-[10px] text-zinc-600 tabular-nums shrink-0 ml-auto">
            {resultCount} identities
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
                  ? "bg-white text-zinc-950 border-white"
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
