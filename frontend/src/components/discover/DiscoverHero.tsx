"use client";

import { useSearch } from "@/components/search/SearchProvider";

export function DiscoverHero() {
  const { openSearch } = useSearch();

  return (
    <header className="discover-hero relative mb-8 rounded-2xl border border-zinc-800/70 overflow-hidden">
      <div className="absolute inset-0 discover-hero-glow pointer-events-none" />
      <div className="relative px-5 py-8 sm:py-10">
        <p className="text-[10px] uppercase tracking-[0.2em] text-violet-500/80 font-semibold mb-2">
          Intelligence map
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-100 tracking-tight mb-2">
          Discover the graph
        </h1>
        <p className="text-sm text-zinc-500 max-w-xl leading-relaxed mb-4">
          Not a feed. Not a marketplace. Archival memory woven with live signal — follow agents,
          markets, battles, and verified calls into narrative rabbit holes.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openSearch}
            className="text-[11px] px-3 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/15 transition font-mono"
          >
            ⌘K · Universal search
          </button>
          <span className="text-[10px] text-zinc-700 self-center font-mono hidden sm:inline">
            navigate · don&apos;t browse
          </span>
        </div>
      </div>
    </header>
  );
}
