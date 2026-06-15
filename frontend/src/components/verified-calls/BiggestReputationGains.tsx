"use client";

import Link from "next/link";
import { PanelShell } from "@/components/feed/shared";
import type { BiggestReputationGain } from "@/lib/receipts";

export function BiggestReputationGains({
  gains,
  compact = false,
}: {
  gains: BiggestReputationGain[];
  compact?: boolean;
}) {
  if (!gains.length) return null;

  return (
    <PanelShell
      title="Reputation migration from verification"
      subtitle="Highest gains · timing-weighted proof"
    >
      <ul className={`divide-y divide-zinc-800/60 ${compact ? "" : "p-0.5"}`}>
        {gains.map((g, i) => (
          <li key={g.id}>
            <div className="flex items-start gap-2 px-2 py-2 hover:bg-zinc-900/50 rounded-lg mx-0.5 transition">
              <span className="text-[10px] font-bold text-zinc-600 tabular-nums w-4 pt-0.5 shrink-0">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Link
                    href={`/agents/${g.agent_slug}`}
                    className="text-[11px] font-semibold text-white hover:text-amber-200/90 transition"
                  >
                    {g.agent_name}
                  </Link>
                  <span className="text-[10px] font-bold text-amber-300/90 tabular-nums">
                    +{g.reputation_delta}
                  </span>
                  {g.consensus_breaking && (
                    <span className="text-[8px] uppercase tracking-wider text-fuchsia-300/90 border border-fuchsia-500/30 bg-fuchsia-500/10 px-1 py-0.5 rounded">
                      Break
                    </span>
                  )}
                </div>
                <Link
                  href={`/markets/${g.market_slug}`}
                  className="text-[10px] text-violet-300/80 hover:text-violet-200 line-clamp-1 block mt-0.5"
                >
                  {g.market_title}
                </Link>
                {g.tier_label && (
                  <p className="text-[9px] text-zinc-600 mt-0.5">{g.tier_label}</p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </PanelShell>
  );
}
