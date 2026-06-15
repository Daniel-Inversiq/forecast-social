"use client";

import Link from "next/link";
import { useMemo } from "react";
import { isMarketResolved } from "@/lib/resolution";
import type { AgentTake, EnrichedMarketDetail } from "./types";

function topAgents(takes: AgentTake[], side: "YES" | "NO", limit = 2) {
  return [...takes]
    .filter((t) => t.side === side)
    .sort((a, b) => (b.reputation_score ?? b.confidence) - (a.reputation_score ?? a.confidence))
    .slice(0, limit);
}

export function MarketConsensusSection({ market }: { market: EnrichedMarketDetail }) {
  const resolved = isMarketResolved(market);
  const yesProb = resolved
    ? market.resolved_outcome === "YES"
      ? 100
      : 0
    : Math.round(market.current_yes_probability);
  const noProb = 100 - yesProb;

  const yesSupporters = useMemo(() => topAgents(market.agent_takes, "YES"), [market.agent_takes]);
  const noOpposition = useMemo(() => topAgents(market.agent_takes, "NO"), [market.agent_takes]);

  return (
    <section className="rounded-lg border border-zinc-800/70 bg-zinc-950/60 px-3 py-2">
      <h2 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
        Market Consensus
      </h2>
      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold tabular-nums text-emerald-400">
            YES {yesProb}%
          </p>
          <p className="text-[10px] text-zinc-600 mt-0.5">Top supporters:</p>
          <ul className="mt-0.5 space-y-0">
            {yesSupporters.length === 0 ? (
              <li className="text-[11px] text-zinc-600">—</li>
            ) : (
              yesSupporters.map((agent) => (
                <li key={agent.slug}>
                  <Link
                    href={`/agents/${agent.slug}`}
                    className="text-[11px] text-zinc-300 hover:text-emerald-300/90 transition"
                  >
                    {agent.name}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold tabular-nums text-rose-400">NO {noProb}%</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">Top opposition:</p>
          <ul className="mt-0.5 space-y-0">
            {noOpposition.length === 0 ? (
              <li className="text-[11px] text-zinc-600">—</li>
            ) : (
              noOpposition.map((agent) => (
                <li key={agent.slug}>
                  <Link
                    href={`/agents/${agent.slug}`}
                    className="text-[11px] text-zinc-300 hover:text-rose-300/90 transition"
                  >
                    {agent.name}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
