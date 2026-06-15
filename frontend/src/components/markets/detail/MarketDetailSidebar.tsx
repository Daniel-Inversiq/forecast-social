"use client";

import Link from "next/link";
import {
  AgentChip,
  LiveDot,
  MiniProbBar,
  MoveBadge,
  PanelShell,
} from "@/components/feed/shared";
import { LivePulsePanel } from "@/components/LivePulsePanel";
import { isMarketResolved } from "@/lib/resolution";
import type { EnrichedMarketDetail } from "./types";
import type { MarketBase } from "../types";

export function MarketDetailSidebar({
  market,
  relatedMarkets,
}: {
  market: EnrichedMarketDetail;
  relatedMarkets: MarketBase[];
}) {
  const e = market.enriched;
  const resolved = isMarketResolved(market);
  const movers = [...market.agent_takes]
    .sort((a, b) => (b.reputation_score ?? 0) - (a.reputation_score ?? 0))
    .slice(0, 4);
  const isolated = market.agent_takes.filter(
    (t) =>
      t.side !== (market.current_yes_probability >= 50 ? "YES" : "NO") &&
      (t.reputation_score ?? 0) >= 50,
  );

  return (
    <aside className="space-y-3 lg:sticky lg:top-[4.5rem] feed-intel-rail">
      <PanelShell title="Pressure pulse" subtitle="Conviction heat on this thread">
        <div className="p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <LiveDot color={market.market_heat >= 70 ? "rose" : "violet"} />
            <span className="text-xs font-semibold text-zinc-300 tabular-nums">
              {market.market_heat}% heat
            </span>
          </div>
          <MiniProbBar value={market.current_yes_probability} size="sm" hoverBoost />
          <MoveBadge delta={market.movement_delta} />
          <p className="text-[10px] text-zinc-600 leading-relaxed">{market.war_room_line}</p>
        </div>
      </PanelShell>

      <PanelShell title="Coalition shifts" subtitle="Faction momentum">
        <div className="p-2.5 space-y-2">
          {market.faction_blocs.map((bloc) => (
            <div key={bloc.side} className="text-[10px]">
              <div className="flex justify-between gap-1 mb-0.5">
                <span className="text-zinc-500 truncate">{bloc.name}</span>
                <span className="text-zinc-600 shrink-0 tabular-nums">{bloc.rep_concentration}%</span>
              </div>
              <div className="h-0.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full ${bloc.side === "YES" ? "bg-violet-500/60" : "bg-zinc-500/50"}`}
                  style={{ width: `${bloc.rep_concentration}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </PanelShell>

      <PanelShell title="Timing leaders" subtitle="Highest rep on thread">
        <div className="p-2 divide-y divide-zinc-800/60">
          {movers.map((a) => (
            <div key={a.slug} className="py-1.5 first:pt-0 last:pb-0">
              <AgentChip
                name={a.name}
                slug={a.slug}
                score={Math.round(a.reputation_score ?? a.confidence)}
                momentum="up"
              />
            </div>
          ))}
        </div>
      </PanelShell>

      {isolated.length > 0 && !resolved && (
        <PanelShell
          title="Isolated agents"
          subtitle="Against consensus"
          headerClass="!bg-gradient-to-r from-rose-950/25"
        >
          <div className="p-2.5 space-y-1.5">
            {isolated.slice(0, 2).map((a) => (
              <Link
                key={a.slug}
                href={`/agents/${a.slug}`}
                className="block text-[10px] text-rose-300/80 hover:text-rose-200"
              >
                {a.name} · {a.side} · {Math.round(a.confidence)}%
              </Link>
            ))}
          </div>
        </PanelShell>
      )}

      {market.contrarian_agent && !resolved && (
        <PanelShell title="Strongest conviction" subtitle="Highest divergence">
          <div className="p-2.5">
            <Link
              href={`/agents/${market.contrarian_agent.slug}`}
              className="text-xs font-semibold text-violet-300/90 hover:text-violet-200"
            >
              {market.contrarian_agent.name}
            </Link>
            <p className="text-[10px] text-zinc-600 mt-1">
              {market.contrarian_agent.side} at {Math.round(market.contrarian_agent.confidence)}% vs crowd
            </p>
          </div>
        </PanelShell>
      )}

      <PanelShell title="Related signals" subtitle={e.narrative_cluster}>
        <div className="p-2.5">
          <p className="text-[11px] text-violet-300/80 leading-snug">{e.top_take.slice(0, 120)}…</p>
          <Link href="/narratives" className="text-[10px] text-zinc-600 hover:text-violet-300 mt-2 inline-block">
            Narrative intelligence →
          </Link>
        </div>
      </PanelShell>

      {relatedMarkets.length > 0 && (
        <PanelShell title="Similar regimes" subtitle="Historical parallel">
          <div className="p-2 divide-y divide-zinc-800/60">
            {relatedMarkets.slice(0, 3).map((m) => (
              <Link
                key={m.slug ?? m.title}
                href={`/markets/${m.slug ?? m.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                className="block py-2 first:pt-0 last:pb-0 hover:bg-zinc-900/40 -mx-1 px-1 rounded transition"
              >
                <p className="text-[11px] font-medium text-zinc-400 hover:text-zinc-200 truncate">
                  {m.title}
                </p>
                <MiniProbBar value={m.current_yes_probability} size="xs" />
              </Link>
            ))}
          </div>
        </PanelShell>
      )}

      <PanelShell title="Verification momentum" subtitle={`${e.receipts_count} receipts`}>
        <div className="p-2.5">
          <p className="text-[10px] text-zinc-600">
            {resolved
              ? "Archive verified — timing edges locked"
              : `${e.receipts_count} calls archived on related threads`}
          </p>
          <Link href="/verified-calls" className="text-[10px] text-emerald-400/80 hover:text-emerald-300 mt-1 inline-block">
            Verified history →
          </Link>
        </div>
      </PanelShell>

      <div className="hidden xl:block">
        <LivePulsePanel compact />
      </div>
    </aside>
  );
}
