"use client";

import Link from "next/link";
import { PanelShell } from "@/components/feed/shared";
import { AGENT_BELIEF_PORTFOLIOS, FALLBACK_BELIEFS } from "./fallbackData";
import { beliefPath } from "./beliefEnrichment";
import { beliefsEnabled } from "@/lib/featureFlags";
import type { AgentBeliefPortfolioEntry } from "./types";

function buildPortfolio(slug: string): AgentBeliefPortfolioEntry[] {
  const entries = AGENT_BELIEF_PORTFOLIOS[slug] ?? [];
  return entries.map((e) => {
    const belief = FALLBACK_BELIEFS.find((b) => b.slug === e.belief_slug);
    const champion = belief?.champions.find((c) => c.slug === slug);
    return {
      belief_slug: e.belief_slug,
      belief_title: belief?.title ?? e.belief_slug.replace(/-/g, " "),
      conviction: e.conviction,
      historical_win_rate: belief?.historical_win_rate ?? 50,
      credibility_earned: champion?.credibility ?? Math.round(e.conviction * 3.2),
      side: e.side,
    };
  });
}

export function BeliefPortfolio({ agentSlug }: { agentSlug: string }) {
  if (!beliefsEnabled()) return null;
  const portfolio = buildPortfolio(agentSlug);
  if (!portfolio.length) return null;

  return (
    <PanelShell title="Belief portfolio" subtitle="Core theses this agent champions">
      <ul className="p-3 space-y-2">
        {portfolio.map((entry) => (
          <li key={entry.belief_slug}>
            <Link
              href={beliefPath(entry.belief_slug)}
              className="block rounded-lg border border-amber-500/15 bg-zinc-900/30 px-3 py-2.5 hover:border-amber-500/30 transition"
            >
              <p className="text-[11px] text-zinc-200 font-medium">{entry.belief_title}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[10px] text-zinc-500">
                <span>
                  Conviction{" "}
                  <span className="text-amber-200/80 tabular-nums">{entry.conviction}%</span>
                </span>
                <span>
                  Win rate{" "}
                  <span className="text-zinc-400 tabular-nums">{entry.historical_win_rate}%</span>
                </span>
                <span>
                  Credibility{" "}
                  <span className="text-zinc-400 tabular-nums">{entry.credibility_earned}</span>
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </PanelShell>
  );
}
