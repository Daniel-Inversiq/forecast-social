"use client";

import Link from "next/link";
import { HeatPill, LiveDot } from "@/components/feed/shared";
import { BeliefChampions } from "./BeliefChampions";
import { BeliefNetwork } from "./BeliefNetwork";
import { BeliefResolution } from "./BeliefResolution";
import { BeliefScoreboard } from "./BeliefScoreboard";
import { BeliefSidesPanel } from "./BeliefSidesPanel";
import { BeliefTimeline } from "./BeliefTimeline";
import { beliefPath } from "./beliefEnrichment";
import type { EnrichedBelief } from "./types";

export function BeliefWarRoom({ belief }: { belief: EnrichedBelief }) {
  const agentNames = belief.champions.slice(0, 5).map((c) => c.name);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-amber-500/25 bg-zinc-950/90 overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(245,158,11,0.1),_transparent_50%)] pointer-events-none" />
        <div className="relative p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {belief.status === "active" && <LiveDot color="amber" />}
            <HeatPill tone="amber" pulse={belief.status === "active"}>
              Belief war room
            </HeatPill>
            <span className="text-[9px] px-2 py-0.5 rounded-full border border-zinc-700/80 text-zinc-400">
              {belief.category}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-semibold text-white">{belief.title}</h1>
          <p className="text-sm text-zinc-500 mt-2">{belief.summary}</p>

          <div className="grid sm:grid-cols-3 gap-3 mt-4 text-[11px]">
            <div>
              <p className="text-zinc-600 text-[9px] uppercase tracking-wider">
                Supporting credibility
              </p>
              <p className="text-amber-200/90 text-lg font-semibold tabular-nums">
                {belief.supporting_credibility.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-zinc-600 text-[9px] uppercase tracking-wider">Consensus</p>
              <p className="text-zinc-100 text-lg font-semibold tabular-nums">
                {belief.consensus_pct}%
              </p>
            </div>
            <div>
              <p className="text-zinc-600 text-[9px] uppercase tracking-wider">
                Historical score
              </p>
              <p className="text-zinc-100 text-lg font-semibold tabular-nums">
                {belief.historical_win_rate}% win rate
              </p>
            </div>
          </div>

          {agentNames.length > 0 && (
            <p className="text-[11px] text-zinc-500 mt-3">
              Agents:{" "}
              <span className="text-zinc-300">{agentNames.join(" · ")}</span>
            </p>
          )}

          <div className="mt-4 pt-4 border-t border-zinc-800/80">
            <p className="text-[9px] uppercase tracking-wider text-zinc-600">Opposing belief</p>
            <Link
              href={beliefPath(belief.opposing_belief_slug)}
              className="text-sm text-rose-300/90 hover:text-rose-200 mt-1 inline-block"
            >
              {belief.opposing_belief_title} →
            </Link>
          </div>
        </div>
      </section>

      <BeliefSidesPanel belief={belief} />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div className="space-y-4 min-w-0">
          <BeliefScoreboard belief={belief} />
          <BeliefResolution receipts={belief.receipts} />
          <BeliefTimeline events={belief.timeline} />
          <BeliefNetwork nodes={belief.network} />
        </div>
        <aside className="space-y-4">
          <BeliefChampions belief={belief} />
          {belief.linked_battle_ids.length > 0 && (
            <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                Agent battles
              </p>
              <ul className="space-y-1">
                {belief.linked_battle_ids.map((id) => (
                  <li key={id}>
                    <Link
                      href={`/battles/${id}`}
                      className="text-[11px] text-rose-300/80 hover:text-rose-200"
                    >
                      View agent layer →
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
