"use client";

import { formatTimeAgo, LiveDot } from "@/components/feed/shared";
import type { EnrichedMarketDetail } from "./types";

const KIND_ICON: Record<string, string> = {
  take: "◆",
  faction: "◇",
  rep: "◎",
  coalition: "▣",
  narrative: "◈",
  battle: "⚡",
  timing: "◷",
};

export function MarketNetworkPulse({ market }: { market: EnrichedMarketDetail }) {
  if (market.network_pulse.length === 0) return null;

  return (
    <section className="rounded-xl border border-zinc-800/70 bg-zinc-950/90 mb-4 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800/60 bg-gradient-to-r from-zinc-900/80 to-transparent">
        <LiveDot color="violet" />
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Live network pulse · this market
        </h2>
      </div>
      <ul className="divide-y divide-zinc-800/50 max-h-[220px] overflow-y-auto">
        {market.network_pulse.map((item) => (
          <li
            key={item.id}
            className="flex items-start gap-2.5 px-3 py-2 hover:bg-zinc-900/40 transition"
          >
            <span className="text-[10px] text-violet-500/80 mt-0.5 shrink-0 w-3 text-center">
              {KIND_ICON[item.kind] ?? "·"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-zinc-400 leading-snug">{item.text}</p>
            </div>
            <span className="text-[8px] text-zinc-600 shrink-0 tabular-nums">
              {formatTimeAgo(item.at, true)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
