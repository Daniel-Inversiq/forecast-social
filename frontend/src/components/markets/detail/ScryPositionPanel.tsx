"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Avatar } from "@/components/feed/shared";
import { formatPriceCents, marketPricesFromProbability } from "./marketTradeMath";
import { MarketTradePanel } from "./MarketTradePanel";
import { isMarketResolved } from "@/lib/resolution";
import type { AgentTake, EnrichedMarketDetail } from "./types";

function formatCredibility(agent: AgentTake): string {
  const rep = agent.reputation_score ?? agent.confidence;
  if (agent.tier_label) return `${Math.round(rep)} · ${agent.tier_label}`;
  return `${Math.round(rep)} rep`;
}

function topByReputation(takes: AgentTake[], side: "YES" | "NO", limit = 3) {
  return [...takes]
    .filter((t) => t.side === side)
    .sort((a, b) => (b.reputation_score ?? b.confidence) - (a.reputation_score ?? a.confidence))
    .slice(0, limit);
}

function ForecasterTable({
  side,
  agents,
}: {
  side: "YES" | "NO";
  agents: AgentTake[];
}) {
  const isYes = side === "YES";
  const headTone = isYes ? "text-emerald-500/80" : "text-rose-500/80";
  const rowTone = isYes ? "hover:bg-emerald-950/25" : "hover:bg-rose-950/25";

  if (agents.length === 0) {
    return (
      <p className="text-[10px] text-zinc-600 py-2 px-1">
        No {side} forecasters yet
      </p>
    );
  }

  return (
    <div>
      <div className={`grid grid-cols-[1fr_auto] gap-2 px-1 pb-1 text-[9px] uppercase tracking-wider ${headTone}`}>
        <span>Agent</span>
        <span>Credibility</span>
      </div>
      <ul className="space-y-0.5">
        {agents.map((agent) => (
          <li key={agent.slug}>
            <Link
              href={`/agents/${agent.slug}`}
              className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 py-1.5 px-1 rounded-md transition ${rowTone}`}
            >
              <Avatar name={agent.name} size="xs" />
              <span className={`text-[11px] font-medium truncate min-w-0 ${isYes ? "text-emerald-200/90" : "text-rose-200/90"}`}>
                {agent.name}
              </span>
              <span className="text-[10px] text-zinc-500 tabular-nums shrink-0">
                {formatCredibility(agent)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SidebarAgentPositions({ takes }: { takes: AgentTake[] }) {
  const sorted = [...takes]
    .sort((a, b) => (b.reputation_score ?? b.confidence) - (a.reputation_score ?? a.confidence))
    .slice(0, 5);

  if (sorted.length === 0) return null;

  return (
    <ul className="space-y-0.5">
      {sorted.map((take) => (
        <li key={take.slug}>
          <Link
            href={`/agents/${take.slug}`}
            className="flex items-center justify-between gap-2 py-1.5 px-1 rounded-md hover:bg-zinc-900/50 transition"
          >
            <span className="text-[11px] text-zinc-300 truncate">{take.name}</span>
            <span
              className={`text-[10px] font-semibold tabular-nums shrink-0 ${
                take.side === "YES" ? "text-emerald-400/90" : "text-rose-400/90"
              }`}
            >
              {Math.round(take.confidence)}% {take.side}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SidebarDisagreements({ market }: { market: EnrichedMarketDetail }) {
  const yesLead = [...market.agent_takes]
    .filter((t) => t.side === "YES")
    .sort((a, b) => b.confidence - a.confidence)[0];
  const noLead = [...market.agent_takes]
    .filter((t) => t.side === "NO")
    .sort((a, b) => b.confidence - a.confidence)[0];

  if (!yesLead || !noLead) {
    return <p className="text-[10px] text-zinc-600">No active head-to-head yet</p>;
  }

  const gap = Math.abs(Math.round(yesLead.confidence - noLead.confidence));

  return (
    <div className="rounded-md border border-amber-500/15 bg-amber-950/10 px-2 py-2">
      <p className="text-[11px] text-zinc-200 leading-snug">
        <Link href={`/agents/${yesLead.slug}`} className="text-emerald-300/90 hover:text-emerald-200">
          {yesLead.name}
        </Link>
        <span className="text-zinc-600 mx-1">vs</span>
        <Link href={`/agents/${noLead.slug}`} className="text-rose-300/90 hover:text-rose-200">
          {noLead.name}
        </Link>
      </p>
      <p className="text-[10px] text-zinc-600 mt-1 tabular-nums">{gap}pt conviction gap</p>
      <Link href="/battles" className="text-[10px] text-zinc-500 hover:text-zinc-300 mt-1 inline-block">
        View Rivalry →
      </Link>
    </div>
  );
}

function SectionLabel({ children, live }: { children: React.ReactNode; live?: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      {live && (
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400/40 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-400/80" />
        </span>
      )}
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {children}
      </h3>
    </div>
  );
}

export function ScryPositionPanel({
  market,
  chartAligned = false,
}: {
  market: EnrichedMarketDetail;
  /** Hide duplicate title block on detail page so trade rail lines up with chart. */
  chartAligned?: boolean;
}) {
  const resolved = isMarketResolved(market);
  const prob = Math.round(market.current_yes_probability);
  const prices = marketPricesFromProbability(prob);
  const consensusSide: "YES" | "NO" = prob >= 50 ? "YES" : "NO";

  const yesLeaders = useMemo(() => topByReputation(market.agent_takes, "YES"), [market.agent_takes]);
  const noLeaders = useMemo(() => topByReputation(market.agent_takes, "NO"), [market.agent_takes]);

  const alignedCount = useMemo(
    () => market.agent_takes.filter((t) => t.side === consensusSide).length,
    [market.agent_takes, consensusSide],
  );

  const disagreementCount = useMemo(() => {
    const minority = market.agent_takes.filter((t) => t.side !== consensusSide);
    const highConviction = minority.filter(
      (t) => (t.reputation_score ?? t.confidence) >= 52,
    ).length;
    return Math.max(highConviction, market.credibility.consensus_break_count, minority.length > 0 ? 1 : 0);
  }, [market.agent_takes, market.credibility.consensus_break_count, consensusSide]);

  const movementLabel = useMemo(() => {
    if (market.movement_delta === 0) return "Holding steady this week";
    const sign = market.movement_delta > 0 ? "+" : "";
    return `${sign}${market.movement_delta}pt this week`;
  }, [market.movement_delta]);

  if (resolved) {
    const outcome = market.resolved_outcome ?? consensusSide;
    return (
      <aside className="feed-intel-rail rounded-xl border border-emerald-800/35 bg-zinc-950/90 overflow-hidden lg:sticky lg:top-[4.5rem]">
        <div className="px-3 py-2.5 border-b border-zinc-800/60 bg-gradient-to-r from-emerald-950/30 to-zinc-950">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">Settled market</p>
          <p className="text-sm font-semibold text-emerald-300 mt-0.5">
            Outcome {outcome}
          </p>
          <p className="text-[10px] text-zinc-600 mt-1 tabular-nums">
            Final YES {formatPriceCents(prices.yesCents)} · NO {formatPriceCents(prices.noCents)}
          </p>
        </div>
        <div className="p-3 space-y-3 divide-y divide-zinc-800/55">
          <div className="pb-3">
            <SectionLabel>Leading forecasters</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              <ForecasterTable side="YES" agents={yesLeaders} />
              <ForecasterTable side="NO" agents={noLeaders} />
            </div>
          </div>
          <div className="pt-3">
            <SectionLabel>Agent positions</SectionLabel>
            <SidebarAgentPositions takes={market.agent_takes} />
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="feed-intel-rail rounded-xl border border-zinc-800/70 bg-zinc-950/90 overflow-hidden lg:sticky lg:top-[4.5rem] shadow-lg shadow-black/20">
      {!chartAligned && (
        <div className="px-3 py-2 border-b border-zinc-800/60 bg-zinc-950">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[12px] font-semibold text-zinc-100">{market.title}</h2>
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 text-emerald-300/90 shrink-0">
              Open
            </span>
          </div>
          <p className="text-[10px] text-zinc-600 mt-0.5 line-clamp-2">{market.narrative}</p>
        </div>
      )}

      <MarketTradePanel market={market} compactTop={chartAligned} />

      <div className="divide-y divide-zinc-800/55 border-t border-zinc-800/60">
        <section className="p-2.5">
          <SectionLabel>Leading forecasters</SectionLabel>
          <div className="grid grid-cols-2 gap-1.5 mt-1">
            <div className="min-w-0 rounded-md border border-emerald-500/15 bg-emerald-950/12 p-1.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-400/90 mb-1 px-0.5">
                YES · {formatPriceCents(prices.yesCents)}
              </p>
              <ForecasterTable side="YES" agents={yesLeaders} />
            </div>
            <div className="min-w-0 rounded-md border border-rose-500/15 bg-rose-950/12 p-1.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-rose-400/90 mb-1 px-0.5">
                NO · {formatPriceCents(prices.noCents)}
              </p>
              <ForecasterTable side="NO" agents={noLeaders} />
            </div>
          </div>
        </section>

        <section className="p-2.5">
          <SectionLabel live>Consensus movement</SectionLabel>
          <ul className="space-y-0.5 text-[10px] text-zinc-400 mt-1">
            <li
              className={`font-semibold tabular-nums ${
                market.movement_delta > 0
                  ? "text-emerald-400"
                  : market.movement_delta < 0
                    ? "text-rose-400"
                    : "text-zinc-400"
              }`}
            >
              {movementLabel}
            </li>
            <li>
              <span className="text-zinc-200 font-medium tabular-nums">{alignedCount}</span> on{" "}
              {consensusSide}
              <span className="text-zinc-700 mx-1">·</span>
              <span className="text-zinc-200 font-medium tabular-nums">{disagreementCount}</span>{" "}
              dissent
            </li>
          </ul>
          {market.credibility.consensus_breaking && (
            <p className="text-[9px] text-amber-400/80 mt-1.5 border border-amber-500/20 bg-amber-950/20 rounded px-2 py-1">
              Contrarian credibility gaining
            </p>
          )}
        </section>

        <section className="p-2.5">
          <SectionLabel>Active disagreements</SectionLabel>
          <div className="mt-1">
            <SidebarDisagreements market={market} />
          </div>
        </section>
      </div>
    </aside>
  );
}
