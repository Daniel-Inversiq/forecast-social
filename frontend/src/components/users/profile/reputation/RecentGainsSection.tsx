"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatTimeAgo } from "@/components/feed/shared";
import type { ScryReceipt } from "./types";
import { buildRecentGains, formatGainLine } from "./recentGains";
export function RecentGainsSection({
  receipts,
  currentCredibility,
}: {
  receipts: ScryReceipt[];
  currentCredibility: number;
}) {
  const gains = useMemo(() => buildRecentGains(receipts), [receipts]);

  if (gains.length === 0) {
    return null;
  }

  const net30Hint =
    gains.filter((g) => g.delta > 0).length > 0
      ? `${gains.filter((g) => g.delta > 0).reduce((s, g) => s + g.delta, 0)}+ from recent receipts`
      : null;

  return (
    <section className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/25 via-zinc-950/60 to-zinc-950/80 overflow-hidden">
      <div className="px-3 sm:px-4 py-3 border-b border-emerald-500/15 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white tracking-tight">Recent gains</h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Momentum from resolved forecasts on your public ledger
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-semibold text-violet-200 tabular-nums">{currentCredibility}</p>
          <p className="text-[9px] text-zinc-600">current credibility</p>
          {net30Hint && (
            <p className="text-[9px] text-emerald-400/80 mt-0.5 tabular-nums">{net30Hint}</p>
          )}
        </div>
      </div>

      <ul className="px-2 sm:px-3 py-2 space-y-0.5">
        {gains.map((gain) => (
            <li key={gain.id}>
              <Link
                href={gain.href}
                className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3 rounded-lg px-2 py-2 hover:bg-emerald-500/5 transition group"
              >
                <p
                  className={`text-[13px] font-semibold tabular-nums leading-snug ${
                    gain.delta > 0
                      ? "text-emerald-300/95"
                      : gain.delta < 0
                        ? "text-rose-300/90"
                        : "text-zinc-400"
                  }`}
                >
                  {formatGainLine(gain.delta, gain.label)}
                </p>
                <span className="text-[9px] text-zinc-600 sm:ml-auto shrink-0 tabular-nums">
                  {formatTimeAgo(gain.created_at)}
                  <span className="text-violet-400/70 opacity-0 group-hover:opacity-100 sm:ml-2">
                    Receipt →
                  </span>
                </span>
              </Link>
            </li>
          ))}
      </ul>

      {gains.some((g) => g.delta < 0) && (
        <p className="px-3 pb-2 text-[9px] text-zinc-600">
          Losses are part of the record — gains above show what moved credibility recently.
        </p>
      )}
    </section>
  );
}
