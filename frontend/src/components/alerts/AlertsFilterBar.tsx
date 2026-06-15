"use client";

import type { AlertFilterKey, AlertSecondaryFilter } from "./types";

const FILTERS: { key: AlertFilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "markets", label: "Markets" },
  { key: "agents", label: "Agents" },
  { key: "positions", label: "Positions" },
  { key: "battles", label: "Battles" },
  { key: "verified", label: "Verified" },
  { key: "signals", label: "Signals" },
  { key: "reputation", label: "Reputation" },
];

const SECONDARY: { key: AlertSecondaryFilter; label: string }[] = [
  { key: "all", label: "All activity" },
  { key: "live", label: "Live" },
  { key: "rising", label: "Rising" },
  { key: "contrarian", label: "Contrarian" },
  { key: "high_conviction", label: "High conviction" },
  { key: "consensus", label: "Consensus shifts" },
  { key: "verified_only", label: "Verified only" },
];

export function AlertsFilterBar({
  filter,
  onFilterChange,
  secondary,
  onSecondaryChange,
  query,
  onQueryChange,
  resultCount,
  unreadCount,
}: {
  filter: AlertFilterKey;
  onFilterChange: (f: AlertFilterKey) => void;
  secondary: AlertSecondaryFilter;
  onSecondaryChange: (s: AlertSecondaryFilter) => void;
  query: string;
  onQueryChange: (q: string) => void;
  resultCount: number;
  unreadCount: number;
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
              placeholder="Search markets, agents, signals…"
              className="w-full h-8 pl-8 pr-3 text-[11px] rounded-lg bg-zinc-900/80 border border-zinc-800/90 text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-sky-500/40 focus:ring-1 focus:ring-sky-500/20"
            />
          </div>
          {unreadCount > 0 && (
            <span className="text-[10px] font-semibold text-violet-300 bg-violet-500/10 border border-violet-500/25 px-2 py-0.5 rounded-full tabular-nums shrink-0">
              {unreadCount} live
            </span>
          )}
          <span className="text-[10px] text-zinc-600 tabular-nums shrink-0">
            {resultCount} events
          </span>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-0.5 feed-scroll-x scrollbar-none">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => onFilterChange(f.key)}
              className={`feed-chip-active shrink-0 text-[10px] px-2.5 py-1 rounded-full border transition ${
                filter === f.key
                  ? "bg-sky-500/15 text-sky-200 border-sky-500/35"
                  : "bg-zinc-900/60 text-zinc-500 border-zinc-800/90 hover:text-zinc-300 hover:border-zinc-600"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 overflow-x-auto pb-0.5 feed-scroll-x scrollbar-none">
          {SECONDARY.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => onSecondaryChange(s.key)}
              className={`feed-chip-active shrink-0 text-[9px] px-2 py-0.5 rounded-md border transition ${
                secondary === s.key
                  ? "bg-violet-500/10 text-violet-200 border-violet-500/30"
                  : "bg-transparent text-zinc-600 border-zinc-800/80 hover:text-zinc-400"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
