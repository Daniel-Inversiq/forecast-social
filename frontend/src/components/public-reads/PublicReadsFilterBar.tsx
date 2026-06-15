"use client";

import type {
  PublicReadCategoryFilter,
  PublicReadConsensusFilter,
  PublicReadResolutionFilter,
  PublicReadTabKey,
  PublicReadTrustFilter,
} from "./types";

const TABS: { key: PublicReadTabKey; label: string }[] = [
  { key: "for_you", label: "For You" },
  { key: "following", label: "Following" },
  { key: "rising", label: "Rising" },
  { key: "challenged", label: "Challenged" },
  { key: "near_resolution", label: "Near Resolution" },
  { key: "new", label: "New" },
];

const CATEGORIES: { key: PublicReadCategoryFilter; label: string }[] = [
  { key: "all", label: "All categories" },
  { key: "Macro", label: "Macro" },
  { key: "AI", label: "AI" },
  { key: "Crypto", label: "Crypto" },
  { key: "Politics", label: "Politics" },
  { key: "Sports", label: "Sports" },
  { key: "Markets", label: "Markets" },
  { key: "Climate", label: "Climate" },
  { key: "Culture", label: "Culture" },
];

export function PublicReadsFilterBar({
  tab,
  onTabChange,
  category,
  onCategoryChange,
  trust,
  onTrustChange,
  resolution,
  onResolutionChange,
  consensus,
  onConsensusChange,
  query,
  onQueryChange,
  resultCount,
}: {
  tab: PublicReadTabKey;
  onTabChange: (t: PublicReadTabKey) => void;
  category: PublicReadCategoryFilter;
  onCategoryChange: (c: PublicReadCategoryFilter) => void;
  trust: PublicReadTrustFilter;
  onTrustChange: (t: PublicReadTrustFilter) => void;
  resolution: PublicReadResolutionFilter;
  onResolutionChange: (r: PublicReadResolutionFilter) => void;
  consensus: PublicReadConsensusFilter;
  onConsensusChange: (c: PublicReadConsensusFilter) => void;
  query: string;
  onQueryChange: (q: string) => void;
  resultCount: number;
}) {
  return (
    <div className="sticky top-[44px] sm:top-[48px] z-40 -mx-3 sm:-mx-5 lg:-mx-6 px-3 sm:px-5 lg:px-6 py-2 mb-3 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md space-y-2">
      <div className="flex gap-1 overflow-x-auto feed-scroll-x scrollbar-none pb-0.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onTabChange(t.key)}
            className={`shrink-0 px-2.5 py-1 text-[11px] rounded-lg border transition whitespace-nowrap ${
              tab === t.key
                ? "profile-tab-active text-white border-transparent"
                : "border-zinc-800/90 text-zinc-500 hover:border-violet-500/30 hover:text-zinc-300 bg-zinc-950/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:flex-1 sm:min-w-[180px] sm:max-w-md">
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search reads, thesis, authors…"
            className="w-full h-8 pl-3 pr-3 text-[11px] rounded-lg bg-zinc-900/80 border border-zinc-800/90 text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40"
          />
        </div>
        <select
          value={category}
          onChange={(e) => onCategoryChange(e.target.value as PublicReadCategoryFilter)}
          className="h-8 w-full sm:w-auto text-[11px] rounded-lg bg-zinc-900/80 border border-zinc-800/90 text-zinc-300 px-2"
          aria-label="Category"
        >
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={trust}
          onChange={(e) => onTrustChange(e.target.value as PublicReadTrustFilter)}
          className="h-8 w-full sm:w-auto text-[11px] rounded-lg bg-zinc-900/80 border border-zinc-800/90 text-zinc-300 px-2"
          aria-label="Trust tier"
        >
          <option value="all">All trust tiers</option>
          <option value="observer">Observer</option>
          <option value="emerging">Emerging</option>
          <option value="trusted">Trusted</option>
          <option value="ranked">Ranked</option>
          <option value="elite">Elite</option>
        </select>
        <select
          value={resolution}
          onChange={(e) => onResolutionChange(e.target.value as PublicReadResolutionFilter)}
          className="h-8 w-full sm:w-auto text-[11px] rounded-lg bg-zinc-900/80 border border-zinc-800/90 text-zinc-300 px-2"
          aria-label="Time to resolution"
        >
          <option value="all">Any resolution</option>
          <option value="7d">Within 7 days</option>
          <option value="30d">Within 30 days</option>
          <option value="90d">Within 90 days</option>
        </select>
        <select
          value={consensus}
          onChange={(e) => onConsensusChange(e.target.value as PublicReadConsensusFilter)}
          className="h-8 w-full sm:w-auto text-[11px] rounded-lg bg-zinc-900/80 border border-zinc-800/90 text-zinc-300 px-2"
          aria-label="Consensus movement"
        >
          <option value="all">Consensus movement</option>
          <option value="moving_up">Moving up</option>
          <option value="moving_down">Moving down</option>
          <option value="large_move">Large move (12+ pt)</option>
        </select>
        <span className="text-[10px] text-zinc-600 tabular-nums shrink-0 sm:ml-auto w-full sm:w-auto">
          {resultCount} reads
        </span>
      </div>
    </div>
  );
}
