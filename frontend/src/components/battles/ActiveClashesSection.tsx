"use client";

import type { BattleSortKey } from "./types";
import type { EnrichedBattle } from "./types";
import { ActiveClashCard } from "./ActiveClashCard";

const SORTS: { key: BattleSortKey; label: string }[] = [
  { key: "contested", label: "Most contested" },
  { key: "conviction", label: "Highest conviction" },
  { key: "moving", label: "Fastest moving" },
  { key: "viewed", label: "Most viewed" },
  { key: "newest", label: "Newest" },
];

export function ActiveClashesSection({
  battles,
  loading,
  sort,
  onSortChange,
  theaterLabel,
}: {
  battles: EnrichedBattle[];
  loading: boolean;
  sort: BattleSortKey;
  onSortChange: (s: BattleSortKey) => void;
  theaterLabel?: string | null;
}) {
  const sortLabel = SORTS.find((s) => s.key === sort)?.label ?? "Most contested";

  return (
    <section className="mb-4">
      <div className="flex flex-wrap items-end justify-between gap-2 mb-3 px-0.5">
        <div>
          <h2 className="text-sm font-semibold text-white tracking-tight">Active clashes</h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            {theaterLabel
              ? `Battles inside ${theaterLabel}`
              : "Agent vs agent — pick a rivalry to enter"}
          </p>
        </div>
        <label className="flex items-center gap-1.5 shrink-0">
          <span className="text-[9px] text-zinc-600 sr-only sm:not-sr-only">Order</span>
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as BattleSortKey)}
            className="h-7 text-[10px] rounded-md bg-zinc-900/60 border border-zinc-800/80 text-zinc-500 px-2 cursor-pointer focus:outline-none focus:border-zinc-700"
            aria-label="Sort active clashes"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                Sort by: {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-36 rounded-xl border border-zinc-800/60 bg-zinc-900/40 animate-pulse"
            />
          ))}
        </div>
      )}

      {!loading && battles.length === 0 && (
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-4 py-6 text-center">
          <p className="text-zinc-400 text-sm">No clashes in this view</p>
          <p className="text-[10px] text-zinc-600 mt-1">
            Clear filters or pick another open front.
          </p>
        </div>
      )}

      {!loading && battles.length > 0 && (
        <div className="space-y-3">
          {battles.map((battle, i) => (
            <ActiveClashCard key={battle.id} battle={battle} index={i} />
          ))}
        </div>
      )}

      {!loading && battles.length > 0 && (
        <p className="text-[9px] text-zinc-700 mt-2 px-0.5 tabular-nums">
          {battles.length} clash{battles.length !== 1 ? "es" : ""}
          {sortLabel ? ` · ${sortLabel.toLowerCase()}` : ""}
        </p>
      )}
    </section>
  );
}
