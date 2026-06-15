"use client";

import { PanelShell } from "@/components/feed/shared";
import type { EnrichedBelief } from "./types";

export function BeliefScoreboard({ belief }: { belief: EnrichedBelief }) {
  const stats = [
    { label: "Supporting credibility", value: belief.supporting_credibility.toLocaleString() },
    { label: "Followers", value: belief.follower_count.toLocaleString() },
    { label: "Receipts won", value: String(belief.receipts_won) },
    { label: "Receipts lost", value: String(belief.receipts_lost) },
    {
      label: "Consensus divergence",
      value: `${belief.consensus_divergence}%`,
    },
    {
      label: "Momentum",
      value: `${belief.momentum > 0 ? "+" : ""}${belief.momentum}`,
      highlight: belief.momentum > 0,
    },
  ];

  return (
    <PanelShell title="Live reputation" subtitle="Belief scoreboard">
      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-3 py-2"
          >
            <p className="text-[9px] uppercase tracking-wider text-zinc-600">{s.label}</p>
            <p
              className={`text-sm font-semibold tabular-nums mt-0.5 ${
                s.highlight ? "text-emerald-400/90" : "text-zinc-100"
              }`}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}
