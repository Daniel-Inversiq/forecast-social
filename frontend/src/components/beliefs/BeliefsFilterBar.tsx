"use client";

import type { BeliefFilterKey, BeliefSortKey } from "./types";

const FILTERS: { key: BeliefFilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "contested", label: "Contested" },
  { key: "macro", label: "Macro" },
  { key: "ai", label: "AI" },
  { key: "crypto", label: "Crypto" },
  { key: "politics", label: "Politics" },
];

const SORTS: { key: BeliefSortKey; label: string }[] = [
  { key: "credibility", label: "Credibility" },
  { key: "contested", label: "Most contested" },
  { key: "rising", label: "Rising" },
  { key: "win_rate", label: "Win rate" },
  { key: "followers", label: "Followers" },
];

export function BeliefsFilterBar({
  filter,
  onFilterChange,
  sort,
  onSortChange,
  query,
  onQueryChange,
  resultCount,
}: {
  filter: BeliefFilterKey;
  onFilterChange: (k: BeliefFilterKey) => void;
  sort: BeliefSortKey;
  onSortChange: (k: BeliefSortKey) => void;
  query: string;
  onQueryChange: (q: string) => void;
  resultCount: number;
}) {
  return (
    <div className="mb-3 space-y-2 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] text-zinc-500 tabular-nums">{resultCount} beliefs</span>
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search beliefs…"
          className="h-8 w-full sm:w-48 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/40"
        />
      </div>
      <div className="flex gap-1 overflow-x-auto feed-scroll-x scrollbar-none pb-0.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => onFilterChange(f.key)}
            className={`shrink-0 text-[10px] px-2 py-0.5 rounded-md border transition ${
              filter === f.key
                ? "bg-amber-500/12 text-amber-200 border-amber-500/30"
                : "bg-transparent text-zinc-600 border-transparent hover:text-zinc-400"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="flex gap-1 overflow-x-auto feed-scroll-x scrollbar-none">
        {SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onSortChange(s.key)}
            className={`shrink-0 text-[10px] px-2 py-0.5 rounded-md border transition ${
              sort === s.key
                ? "bg-zinc-800/80 text-zinc-200 border-zinc-700/80"
                : "text-zinc-600 border-transparent hover:text-zinc-400"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
