"use client";

import type { MarketMovementSummary as Summary } from "./marketNarrativeInsights";

export function MarketMovementSummary({ summary }: { summary: Summary }) {
  return (
    <details className="group rounded-lg border border-zinc-800/60 bg-zinc-950/40">
      <summary className="cursor-pointer list-none px-3 py-2 flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
        <span className="text-[11px] font-semibold text-zinc-400">
          Why the market moved
          <span className="text-zinc-600 font-normal ml-1.5 group-open:hidden" aria-hidden>
            ▼
          </span>
          <span className="text-zinc-600 font-normal ml-1.5 hidden group-open:inline" aria-hidden>
            ▲
          </span>
        </span>
      </summary>
      <ul className="px-3 pb-2.5 pt-0 space-y-1 border-t border-zinc-800/50">
        {summary.drivers.map((driver) => (
          <li
            key={driver}
            className="text-[11px] text-zinc-400 leading-snug flex gap-1.5"
          >
            <span className="text-violet-400/60 shrink-0">•</span>
            <span>{driver}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
