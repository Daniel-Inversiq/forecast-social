"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Avatar } from "@/components/feed/shared";
import { ReputationTierBadge } from "@/components/reputation/ReputationTierBadge";
import type { MarketSide } from "@/components/markets/marketSide";
import { reputationYesShare, splitTakesBySide } from "./agentConsensus";
import type { AgentTake, EnrichedMarketDetail } from "./types";

function AgentStanceCard({
  take,
  mostCredible,
  dimmed,
}: {
  take: AgentTake;
  mostCredible: boolean;
  dimmed: boolean;
}) {
  const isYes = take.side === "YES";
  const accent = isYes ? "text-emerald-300" : "text-rose-300";
  return (
    <Link
      href={`/agents/${take.slug}`}
      className={`block rounded-lg border p-2.5 transition feed-hover-lift min-w-0 ${
        mostCredible
          ? isYes
            ? "border-emerald-500/30 bg-emerald-950/15"
            : "border-rose-500/30 bg-rose-950/15"
          : "border-zinc-800/70 bg-zinc-950/60 hover:border-zinc-700"
      } ${dimmed ? "opacity-55" : ""}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Avatar name={take.name} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[12px] font-semibold text-zinc-100 truncate">{take.name}</span>
            {take.tier_key && take.tier_label && (
              <ReputationTierBadge tierKey={take.tier_key} tierLabel={take.tier_label} compact />
            )}
          </div>
          <p className="text-[9px] text-zinc-500 tabular-nums">
            {take.reputation_score != null && (
              <>
                <span className="text-zinc-300 font-semibold">
                  {Math.round(take.reputation_score)}
                </span>{" "}
                rep
                {(take.verified_calls_count ?? 0) > 0 && (
                  <> · {take.verified_calls_count} receipts</>
                )}
              </>
            )}
          </p>
        </div>
        <span className={`text-[13px] font-bold tabular-nums shrink-0 ${accent}`}>
          {Math.round(take.confidence)}%
        </span>
      </div>
      {take.reasoning && (
        <p className="text-[10px] text-zinc-500 leading-snug mt-1.5 line-clamp-2">
          &ldquo;{take.reasoning}&rdquo;
        </p>
      )}
      {mostCredible && (
        <p className={`text-[8px] font-bold uppercase tracking-[0.14em] mt-1.5 ${accent}`}>
          Most credible on {take.side}
        </p>
      )}
    </Link>
  );
}

/**
 * Who's on each side, weighted by reputation — the SCRY answer to an order
 * book. Credibility, not headcount, is the consensus.
 */
export function AgentConsensusSection({
  market,
  selectedSide = null,
}: {
  market: EnrichedMarketDetail;
  selectedSide?: MarketSide | null;
}) {
  const sides = useMemo(() => splitTakesBySide(market.agent_takes), [market.agent_takes]);
  const yesShare = useMemo(
    () => reputationYesShare(market.credibility_split, sides),
    [market.credibility_split, sides],
  );

  if (sides.yes.length === 0 && sides.no.length === 0) return null;

  return (
    <section className="mb-4" aria-labelledby="agent-consensus-heading">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="agent-consensus-heading" className="text-[13px] font-bold text-zinc-200">
          Agent consensus
        </h2>
        <span className="text-[10px] text-zinc-600">
          Weighted by reputation, not headcount
        </span>
      </div>

      {/* Reputation-weighted split bar */}
      <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/60 px-3 py-2.5 mb-2">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[11px] font-bold tabular-nums text-emerald-300">
            YES · {yesShare}% of reputation
          </span>
          <span className="text-[11px] font-bold tabular-nums text-rose-300">
            {100 - yesShare}% · NO
          </span>
        </div>
        <div className="h-2 rounded-full bg-zinc-800/80 overflow-hidden flex">
          <div
            className="h-full bg-gradient-to-r from-emerald-500/80 to-emerald-400/60"
            style={{ width: `${yesShare}%` }}
          />
          <div className="h-full flex-1 bg-gradient-to-r from-rose-400/60 to-rose-500/80" />
        </div>
        <p className="text-[9px] text-zinc-600 mt-1 tabular-nums">
          {sides.yes.length} agent{sides.yes.length === 1 ? "" : "s"} YES ·{" "}
          {sides.no.length} agent{sides.no.length === 1 ? "" : "s"} NO
          {market.credibility_split?.consensus_breaking &&
            " · consensus break in progress"}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        <div className="space-y-1.5 min-w-0">
          {sides.yes.length === 0 ? (
            <p className="text-[10px] text-zinc-600 rounded-lg border border-zinc-800/60 px-3 py-4 text-center">
              No agent on YES yet.
            </p>
          ) : (
            sides.yes
              .slice(0, 4)
              .map((t, i) => (
                <AgentStanceCard
                  key={t.slug}
                  take={t}
                  mostCredible={i === 0}
                  dimmed={selectedSide === "NO"}
                />
              ))
          )}
        </div>
        <div className="space-y-1.5 min-w-0">
          {sides.no.length === 0 ? (
            <p className="text-[10px] text-zinc-600 rounded-lg border border-zinc-800/60 px-3 py-4 text-center">
              No agent on NO yet — consensus unchallenged.
            </p>
          ) : (
            sides.no
              .slice(0, 4)
              .map((t, i) => (
                <AgentStanceCard
                  key={t.slug}
                  take={t}
                  mostCredible={i === 0}
                  dimmed={selectedSide === "YES"}
                />
              ))
          )}
        </div>
      </div>
    </section>
  );
}
