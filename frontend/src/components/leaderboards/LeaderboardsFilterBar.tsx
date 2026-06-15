"use client";

import {
  RANKING_PERIODS,
  type RankingCategoryKey,
  type RankingPeriodKey,
  type RankingTrustTierKey,
  type RankingTypeKey,
} from "./types";

const RANKING_TYPES: { key: RankingTypeKey; label: string }[] = [
  { key: "top_credibility", label: "Top Credibility" },
  { key: "fastest_rising", label: "Fastest Rising" },
  { key: "best_early_signals", label: "Best Early Signals" },
  { key: "best_calibration", label: "Best Calibration" },
  { key: "best_battle_record", label: "Best Battle Record" },
  { key: "top_macro", label: "Top Macro" },
  { key: "top_ai", label: "Top AI" },
  { key: "top_politics", label: "Top Political" },
];

const CATEGORIES: { key: RankingCategoryKey; label: string }[] = [
  { key: "all", label: "All categories" },
  { key: "macro", label: "Macro" },
  { key: "politics", label: "Politics" },
  { key: "crypto", label: "Crypto" },
  { key: "ai", label: "AI" },
  { key: "tech", label: "Tech" },
  { key: "sports", label: "Sports" },
  { key: "climate", label: "Climate" },
];

const TRUST_TIERS: { key: RankingTrustTierKey; label: string }[] = [
  { key: "all", label: "All tiers" },
  { key: "verified", label: "Verified" },
  { key: "elite", label: "Elite" },
  { key: "ranked", label: "Ranked" },
  { key: "trusted", label: "Trusted" },
  { key: "emerging", label: "Emerging" },
  { key: "observer", label: "Observer" },
];

function FilterPills<T extends string>({
  items,
  value,
  onChange,
  activeClass = "bg-violet-500/12 text-violet-200 border-violet-500/30",
}: {
  items: { key: T; label: string }[];
  value: T;
  onChange: (k: T) => void;
  activeClass?: string;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-0.5 feed-scroll-x scrollbar-none">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={`shrink-0 text-[10px] px-2 py-0.5 rounded-md border transition ${
            value === item.key
              ? `${activeClass} shadow-sm shadow-violet-950/20`
              : "bg-transparent text-zinc-600 border-transparent hover:text-zinc-400 hover:bg-zinc-900/50"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function LeaderboardsFilterBar({
  rankingType,
  onRankingTypeChange,
  period,
  onPeriodChange,
  category,
  onCategoryChange,
  trustTier,
  onTrustTierChange,
  query,
  onQueryChange,
  resultCount,
}: {
  rankingType: RankingTypeKey;
  onRankingTypeChange: (k: RankingTypeKey) => void;
  period: RankingPeriodKey;
  onPeriodChange: (k: RankingPeriodKey) => void;
  category: RankingCategoryKey;
  onCategoryChange: (k: RankingCategoryKey) => void;
  trustTier: RankingTrustTierKey;
  onTrustTierChange: (k: RankingTrustTierKey) => void;
  query: string;
  onQueryChange: (q: string) => void;
  resultCount: number;
}) {
  return (
    <div className="sticky top-[44px] sm:top-[48px] z-40 -mx-3 sm:-mx-5 lg:-mx-6 px-3 sm:px-5 lg:px-6 py-2 mb-3 border-b border-zinc-800/70 bg-zinc-950/95 backdrop-blur-md space-y-2">
      <FilterPills
        items={RANKING_TYPES}
        value={rankingType}
        onChange={onRankingTypeChange}
      />

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[9px] uppercase tracking-wider text-zinc-600 shrink-0 w-12">
            Period
          </span>
          <FilterPills
            items={RANKING_PERIODS}
            value={period}
            onChange={onPeriodChange}
            activeClass="bg-emerald-500/10 text-emerald-200/90 border-emerald-500/25"
          />
        </div>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[9px] uppercase tracking-wider text-zinc-600 shrink-0 w-14">
            Category
          </span>
          <select
            value={category}
            onChange={(e) => onCategoryChange(e.target.value as RankingCategoryKey)}
            className="h-7 min-w-[120px] flex-1 max-w-[180px] text-[10px] rounded-md bg-zinc-900/70 border border-zinc-800/80 text-zinc-300 px-2 focus:outline-none focus:border-violet-500/35"
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-[9px] uppercase tracking-wider text-zinc-600 shrink-0 w-14">
            Trust tier
          </span>
          <select
            value={trustTier}
            onChange={(e) => onTrustTierChange(e.target.value as RankingTrustTierKey)}
            className="h-7 min-w-[120px] flex-1 max-w-[180px] text-[10px] rounded-md bg-zinc-900/70 border border-zinc-800/80 text-zinc-300 px-2 focus:outline-none focus:border-violet-500/35"
          >
            {TRUST_TIERS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

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
            placeholder="Search forecasters…"
            className="w-full h-8 pl-8 pr-3 text-[11px] rounded-lg bg-zinc-900/70 border border-zinc-800/80 text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/35 focus:ring-1 focus:ring-violet-500/15"
          />
        </div>
        <span className="text-[10px] text-zinc-600 tabular-nums shrink-0">
          {resultCount} on the board
        </span>
      </div>
    </div>
  );
}
