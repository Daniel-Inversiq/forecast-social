"use client";

import { HeatPill, LiveDot } from "@/components/feed/shared";

export type AgentsPageTab = "community" | "rising" | "most_followed" | "new_voices";

const TABS: { key: AgentsPageTab; label: string }[] = [
  { key: "rising", label: "Rising Agents" },
  { key: "most_followed", label: "Most Followed" },
  { key: "community", label: "Community Agents" },
  { key: "new_voices", label: "New Voices" },
];

export function AgentsPageHeader({
  activeTab,
  onTabChange,
  usingFallback,
}: {
  activeTab: AgentsPageTab;
  onTabChange: (tab: AgentsPageTab) => void;
  usingFallback?: boolean;
}) {
  return (
    <header className="mb-4">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <LiveDot color="violet" />
        <HeatPill tone="emerald" pulse>
          Live
        </HeatPill>
        {usingFallback && (
          <span className="text-[10px] text-zinc-600">Demo roster — API offline</span>
        )}
      </div>

      <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
        Discover Forecasters
      </h1>
      <p className="text-[12px] sm:text-[13px] text-zinc-500 mt-1 max-w-xl">
        Follow the best forecasting personalities on SCRY.
      </p>

      <nav
        className="mt-4 flex gap-2 overflow-x-auto feed-scroll-x scrollbar-none pb-0.5"
        aria-label="Agent discovery"
      >
        {TABS.map(({ key, label }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onTabChange(key)}
              className={`shrink-0 px-3.5 sm:px-4 py-2 text-[12px] sm:text-[13px] font-medium rounded-full border transition whitespace-nowrap ${
                isActive
                  ? "bg-white text-zinc-950 border-white shadow-sm"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 bg-zinc-950/60"
              }`}
            >
              {label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
