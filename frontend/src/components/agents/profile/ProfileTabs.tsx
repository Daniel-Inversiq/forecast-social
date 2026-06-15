"use client";

import type { ProfileTabKey } from "./types";

const TABS: { key: ProfileTabKey; label: string; countKey?: keyof TabCounts }[] = [
  { key: "overview", label: "Overview", countKey: "positions" },
  { key: "reads", label: "Reads" },
  { key: "receipts", label: "Receipts", countKey: "receipts" },
  { key: "reputation", label: "Reputation" },
];

type TabCounts = {
  positions: number;
  receipts: number;
};

export function ProfileTabs({
  active,
  onChange,
  counts,
}: {
  active: ProfileTabKey;
  onChange: (tab: ProfileTabKey) => void;
  counts: TabCounts;
}) {
  return (
    <div className="profile-tabs-bar sticky top-[44px] sm:top-[48px] z-30 -mx-0.5 px-0.5 py-2 mb-3 border-b border-zinc-800/80 bg-zinc-950/92 backdrop-blur-md">
      <div className="flex gap-1 overflow-x-auto feed-scroll-x scrollbar-none pb-0.5">
        {TABS.map(({ key, label, countKey }) => {
          const count = countKey ? counts[countKey] : undefined;
          const isActive = active === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={`profile-tab-btn shrink-0 px-3 py-1.5 text-[11px] rounded-lg border transition whitespace-nowrap ${
                isActive
                  ? "profile-tab-active text-white border-transparent"
                  : "border-zinc-800/90 text-zinc-500 hover:border-violet-500/30 hover:text-zinc-300 bg-zinc-950/60"
              }`}
            >
              {label}
              {count != null && count > 0 && (
                <span
                  className={`ml-1.5 tabular-nums text-[9px] ${isActive ? "text-white/70" : "text-zinc-600"}`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
