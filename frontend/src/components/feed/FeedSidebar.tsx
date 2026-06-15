"use client";



import Link from "next/link";

import { useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";

import { titleToSlug } from "@/lib/slugs";

import { LivePulsePanel, type PulseData } from "@/components/LivePulsePanel";
import { RecentReceiptRow } from "@/components/feed/RecentReceiptRow";
import { useRecentReceipts } from "@/hooks/useRecentReceipts";

import type { FeedMarket } from "./shared";

import {

  AgentChip,

  Avatar,

  HeatPill,

  MiniProbBar,

  MiniSparkline,

  MomentumIndicator,

  MoveBadge,

  PanelShell,

  syntheticMove,

  urgencyStyle,

} from "./shared";

import { momentumFromSeed, rankDeltaFromSeed } from "./motion";



type AgentRow = {

  name: string;

  slug: string;

  niche: string;

  avatar_color: string;

  streak: number;

  accuracy_score: number;

};



type FollowingAgent = {

  name: string;

  slug: string;

  niche: string;

  avatar_color: string;

};



type IntelBattle = {

  id: string;

  agent_a: { name: string; slug: string };

  agent_b: { name: string; slug: string };

  market_title?: string | null;

  disagreement_score: number;

  intensity: string;

  widening?: boolean;

};



type ReputationMove = {

  agent: { name: string; slug: string; niche: string };

  reputation_delta: number;

  trend: string;

  label: string;

};



function CompactMarketRow({ market }: { market: FeedMarket }) {

  const urgency = urgencyStyle[market.urgency] ?? urgencyStyle.cooling;

  const move = syntheticMove(market.title);

  const slug = market.slug ?? titleToSlug(market.title);



  return (

    <li>

      <Link

        href={`/markets/${slug}`}

        className="block p-2 -mx-0.5 rounded-lg hover:bg-zinc-900/80 border border-transparent hover:border-zinc-800/80 transition group feed-hover-lift cursor-pointer"

      >

        <div className="flex items-start justify-between gap-1.5 mb-0.5">

          <p className="text-[10px] font-medium scry-text-primary leading-snug line-clamp-2 group-hover:text-white">

            {market.narrative?.trim() || market.title}

          </p>

          <div className="flex flex-col items-end gap-0.5 shrink-0">

            <MoveBadge delta={move} />

            <MiniSparkline seed={market.title} width={28} height={10} />

          </div>

        </div>

        <MiniProbBar value={market.current_yes_probability} size="xs" hoverBoost />

        <div className="flex items-center justify-between mt-0.5 text-[9px]">

          <span className={`capitalize ${urgency.text}`}>{market.urgency}</span>

          <span className="text-zinc-600">{market.agent_count} agents</span>

        </div>

      </Link>

    </li>

  );

}



type StreamBattle = {

  id: string;

  agent_a: { name: string; slug: string };

  agent_b: { name: string; slug: string };

  market_title?: string | null;

  disagreement_score: number;

  intensity: string;

  widening?: boolean;

};



type StreamRepMove = {

  agent: { name: string; slug: string; niche?: string };

  reputation_delta: number;

  trend?: string;

  label?: string;

};



export function FeedSidebar({

  followingAgents,

  streamBattles = [],

  streamRepMoves = [],

  streamPulse = null,

  streamConnected = false,

  priorityRail = false,

}: {

  followingAgents: FollowingAgent[];

  streamBattles?: StreamBattle[];

  streamRepMoves?: StreamRepMove[];

  streamPulse?: PulseData | null;

  streamConnected?: boolean;

  /** Home: sticky rail with hottest battles, rising agents, receipts first. */

  priorityRail?: boolean;

}) {

  const [topAgents, setTopAgents] = useState<AgentRow[]>([]);

  const [markets, setMarkets] = useState<FeedMarket[]>([]);

  const [recommended, setRecommended] = useState<AgentRow[]>([]);

  const [battleMarkets, setBattleMarkets] = useState<FeedMarket[]>([]);

  const [intelBattles, setIntelBattles] = useState<IntelBattle[]>([]);

  const [repMoves, setRepMoves] = useState<ReputationMove[]>([]);



  useEffect(() => {

    if (streamBattles.length) setIntelBattles(streamBattles.slice(0, 4) as IntelBattle[]);

    if (streamRepMoves.length) {

      setRepMoves(

        streamRepMoves.slice(0, 5).map((m) => ({

          agent: {

            name: m.agent.name,

            slug: m.agent.slug,

            niche: m.agent.niche ?? "",

          },

          reputation_delta: m.reputation_delta,

          trend: m.trend ?? "rising",

          label: m.label ?? "Credibility shift",

        })),

      );

    }

  }, [streamBattles, streamRepMoves]);



  useEffect(() => {

    async function load() {

      try {

        const [agentsRes, marketsRes, intelRes] = await Promise.all([

          apiFetch("/agents"),

          apiFetch("/markets"),

          apiFetch("/feed/intelligence"),

        ]);



        if (agentsRes.ok) {

          const agents = (await agentsRes.json()) as AgentRow[];

          const sorted = [...agents].sort((a, b) => b.accuracy_score - a.accuracy_score);

          setTopAgents(sorted.slice(0, 6));

          setRecommended(sorted.slice(2, 7));

        }



        if (marketsRes.ok) {

          const data = (await marketsRes.json()) as FeedMarket[];

          const order: Record<string, number> = { hot: 0, contested: 1, rising: 2, cooling: 3 };

          const sorted = [...data].sort(

            (a, b) => (order[a.urgency] ?? 4) - (order[b.urgency] ?? 4),

          );

          setMarkets(sorted.slice(0, 4));

          setBattleMarkets(sorted.filter((m) => m.urgency === "contested").slice(0, 3));

        }



        if (intelRes.ok) {

          const intel = await intelRes.json();

          if (Array.isArray(intel.battles)) setIntelBattles(intel.battles.slice(0, 4));

          if (Array.isArray(intel.reputation_movements)) {

            setRepMoves(intel.reputation_movements.slice(0, 5));

          }

        }

      } catch {

        /* panels use their own fallbacks */

      }

    }



    load();

    const id = setInterval(load, 30_000);

    return () => clearInterval(id);

  }, []);



  const recentReceipts = useRecentReceipts(streamPulse);

  const risingRows =

    repMoves.length > 0

      ? repMoves

      : topAgents.map((a) => ({

          agent: { name: a.name, slug: a.slug, niche: a.niche },

          reputation_delta: rankDeltaFromSeed(a.slug),

          trend: "rising",

          label: "Reputation mover",

        }));



  const asideClass = priorityRail
    ? "hidden lg:block space-y-3 feed-intel-rail feed-intel-rail--sticky sticky top-[108px] self-start max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-none"
    : "hidden lg:block space-y-4 feed-intel-rail";

  return (

    <aside className={asideClass}>

      {intelBattles.length > 0 && (

        <PanelShell

          title="Hottest battles"

          subtitle="Agent rivalries · open verdicts"

          badge={<HeatPill tone="rose" pulse>Live</HeatPill>}

          headerClass="!py-2"

        >

          <ul className="p-2 space-y-1.5">

            {intelBattles.map((b) => (

              <li key={b.id} className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-2">

                <p className="text-[10px] text-zinc-200 leading-snug">

                  <Link href={`/agents/${b.agent_a.slug}`} className="text-white hover:underline">

                    {b.agent_a.name}

                  </Link>

                  <span className="text-zinc-600"> vs </span>

                  <Link href={`/agents/${b.agent_b.slug}`} className="text-white hover:underline">

                    {b.agent_b.name}

                  </Link>

                </p>

                {b.market_title && (

                  <p className="text-[9px] text-zinc-500 mt-0.5 line-clamp-1">{b.market_title}</p>

                )}

                <div className="flex items-center gap-1 mt-0.5">

                  <HeatPill tone="amber">{Math.round(b.disagreement_score)} rivalry</HeatPill>

                  {b.widening && <HeatPill tone="rose">Widening</HeatPill>}

                  <span className="text-[8px] text-zinc-600 capitalize">{b.intensity}</span>

                </div>

              </li>

            ))}

          </ul>

          <div className="px-2 pb-1.5">

            <Link href="/battles" className="text-[9px] text-violet-400 hover:text-violet-300">

              All rivalries →

            </Link>

          </div>

        </PanelShell>

      )}



      <PanelShell

        title="Rising agents"

        subtitle="Emerging trust · forecast quality"

        badge={<HeatPill tone="sky" pulse>Live</HeatPill>}

        headerClass="!py-2"

      >

        <ul className="p-2 space-y-0.5">

          {risingRows.length === 0 ? (

            <li className="text-[10px] text-zinc-600 px-2 py-2">Loading agents…</li>

          ) : (

            risingRows.map((row, i) => {

              const agent = "agent" in row ? row.agent : row;

              const slug = agent.slug;

              const name = agent.name;

              const delta = "reputation_delta" in row ? row.reputation_delta : 0;

              const label = "label" in row ? row.label : undefined;

              const mom = momentumFromSeed(slug);

              return (

                <li key={slug} className="flex items-center gap-1.5 py-1">

                  <span className="text-[9px] text-zinc-700 w-3 tabular-nums font-medium">{i + 1}</span>

                  <div className="flex-1 min-w-0">

                    <AgentChip

                      name={name}

                      slug={slug}

                      niche={"niche" in agent ? agent.niche : undefined}

                      momentum={mom}

                      rankDelta={delta}

                    />

                    {label && <p className="text-[8px] text-violet-400/70 pl-1">{label}</p>}

                  </div>

                  <MiniSparkline seed={slug} tone="sky" width={36} height={12} />

                </li>

              );

            })

          )}

        </ul>

      </PanelShell>



      <PanelShell

        title="Recent receipts"

        subtitle="Verified proof · network archive"

        badge={<HeatPill tone="emerald">Proof</HeatPill>}

        headerClass="!py-2"

      >

        <ul className="p-2 space-y-1.5">

          {recentReceipts.slice(0, 5).map((receipt) => (

            <li key={receipt.id} className="rounded-lg border border-emerald-500/18 bg-emerald-950/12 p-1.5">

              <RecentReceiptRow receipt={receipt} />

            </li>

          ))}

        </ul>

        <div className="px-2 pb-1.5">

          <Link href="/verified-calls" className="text-[9px] text-emerald-400 hover:text-emerald-300">

            All receipts →

          </Link>

        </div>

      </PanelShell>



      {!priorityRail && (
      <LivePulsePanel

        compact

        className="!rounded-xl !shadow-md"

        streamPulse={streamPulse}

        streamConnected={streamConnected}

      />
      )}



      {!priorityRail && battleMarkets.length > 0 && intelBattles.length === 0 && (

        <PanelShell

          title="Active rivalries"

          subtitle="Highest conviction splits"

          badge={<HeatPill tone="rose">Contested</HeatPill>}

          headerClass="!py-1.5"

        >

          <ul className="p-1.5 space-y-0.5">

            {battleMarkets.map((m) => (

              <li key={m.title}>

                <Link

                  href={`/markets/${m.slug ?? titleToSlug(m.title)}`}

                  className="block p-1 rounded-lg hover:bg-zinc-900/80 transition"

                >

                  <p className="text-[10px] font-medium text-zinc-200 line-clamp-2">

                    {m.narrative?.trim() || m.title}

                  </p>

                  <p className="text-[9px] text-amber-400/80 mt-0.5">{m.agent_count} agents · open</p>

                </Link>

              </li>

            ))}

          </ul>

          <div className="px-2 pb-1.5">

            <Link href="/battles" className="text-[9px] text-violet-400 hover:text-violet-300">

              All rivalries →

            </Link>

          </div>

        </PanelShell>

      )}



      {!priorityRail && (
      <section className="rounded-xl border border-zinc-800/90 bg-zinc-950/80 p-2.5 shadow-md shadow-black/20">

        <div className="flex items-center justify-between gap-2 mb-2">

          <h3 className="text-xs font-semibold scry-text-primary tracking-tight">Following</h3>

          <Link href="/following" className="text-[9px] text-violet-400 hover:text-violet-300 feed-chip-active">

            Your agents →

          </Link>

        </div>

        {followingAgents.length === 0 ? (

          <p className="text-[9px] text-zinc-600 px-0.5">Follow agents to track rivalries and reputation.</p>

        ) : (

          <ul className="space-y-1">

            {followingAgents.slice(0, 5).map((agent) => (

              <li key={agent.slug}>

                <Link

                  href={`/agents/${agent.slug}`}

                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-zinc-900/80 transition feed-hover-lift cursor-pointer"

                >

                  <Avatar name={agent.name} color={agent.avatar_color} size="xs" />

                  <div className="min-w-0 flex-1">

                    <p className="text-[10px] font-medium text-zinc-200 truncate">{agent.name}</p>

                    <p className="text-[9px] text-violet-400/60">In your watchlist</p>

                  </div>

                  <MomentumIndicator direction="up" label="Live" />

                </Link>

              </li>

            ))}

          </ul>

        )}

      </section>
      )}



      {!priorityRail && recommended.length > 0 && (

        <section className="rounded-xl border border-zinc-800/90 bg-zinc-950/80 p-2.5 shadow-md shadow-black/20">

          <h3 className="text-xs font-semibold scry-text-primary tracking-tight mb-0.5">Rising for you</h3>

          <p className="text-[9px] scry-text-tertiary mb-2">Distribution unlocked through trust</p>

          <ul className="space-y-0">

            {recommended.map((a) => (

              <li key={a.slug}>

                <AgentChip

                  name={a.name}

                  slug={a.slug}

                  niche={a.niche}

                  score={a.accuracy_score}

                  momentum={momentumFromSeed(a.slug)}

                />

              </li>

            ))}

          </ul>

        </section>

      )}



      {!priorityRail && (
      <PanelShell title="Active narratives" subtitle="Infrastructure conviction loops" headerClass="!py-2">

        <ul className="p-2 space-y-1">

          {markets.length === 0 ? (

            <li className="text-[10px] text-zinc-600 py-1.5">Scanning narratives…</li>

          ) : (

            markets.map((m) => <CompactMarketRow key={m.title} market={m} />)

          )}

        </ul>

      </PanelShell>
      )}

    </aside>

  );

}


