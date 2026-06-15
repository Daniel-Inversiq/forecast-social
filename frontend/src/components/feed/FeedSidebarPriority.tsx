"use client";



import Link from "next/link";

import { useEffect, useMemo, useState } from "react";

import { apiFetchOptional } from "@/lib/api";

import type { PulseData } from "@/components/LivePulsePanel";
import { RecentReceiptRow } from "@/components/feed/RecentReceiptRow";
import { useRecentReceipts } from "@/hooks/useRecentReceipts";

import { momentumFromSeed, rankDeltaFromSeed } from "./motion";



type AgentRow = {

  name: string;

  slug: string;

  niche: string;

  avatar_color: string;

  accuracy_score: number;

};



type IntelBattle = {

  id: string;

  agent_a: { name: string; slug: string };

  agent_b: { name: string; slug: string };

  market_title?: string | null;

  disagreement_score: number;

};



type ReputationMove = {

  agent: { name: string; slug: string; niche: string };

  reputation_delta: number;

};



type StreamBattle = {

  id: string;

  agent_a: { name: string; slug: string };

  agent_b: { name: string; slug: string };

  market_title?: string | null;

  disagreement_score: number;

};



type StreamRepMove = {

  agent: { name: string; slug: string; niche?: string };

  reputation_delta: number;

};



export function uniqueBySlug<T>(items: T[], getSlug?: (item: T) => string): T[] {

  const slugOf = getSlug ?? ((item: T) => (item as { slug: string }).slug);

  const seen = new Set<string>();

  return items.filter((item) => {

    const slug = slugOf(item);

    if (seen.has(slug)) return false;

    seen.add(slug);

    return true;

  });

}



function SidebarBlock({

  title,

  href,

  hrefLabel,

  children,

}: {

  title: string;

  href: string;

  hrefLabel: string;

  children: React.ReactNode;

}) {

  return (

    <section className="feed-sidebar-card feed-sidebar-block">

      <div className="flex items-baseline justify-between gap-2 mb-2 min-h-[18px]">

        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">

          {title}

        </h3>

        <Link href={href} className="text-[10px] text-zinc-500 hover:text-zinc-300 transition shrink-0">

          {hrefLabel}

        </Link>

      </div>

      <ul className="space-y-0 divide-y divide-zinc-800/35">{children}</ul>

    </section>

  );

}



function SidebarRow({ children, href }: { children: React.ReactNode; href?: string }) {

  const inner = (

    <div className="feed-sidebar-row flex flex-col justify-center min-h-[48px] py-2 px-0.5">

      {children}

    </div>

  );

  if (href) {

    return (

      <li>

        <Link href={href} className="block hover:bg-zinc-900/35 -mx-1 px-1 rounded-md transition">

          {inner}

        </Link>

      </li>

    );

  }

  return <li>{inner}</li>;

}



export function FeedSidebarPriority({

  streamBattles = [],

  streamRepMoves = [],

  streamPulse = null,

}: {

  streamBattles?: StreamBattle[];

  streamRepMoves?: StreamRepMove[];

  streamPulse?: PulseData | null;

}) {

  const [intelBattles, setIntelBattles] = useState<IntelBattle[]>([]);

  const [repMoves, setRepMoves] = useState<ReputationMove[]>([]);

  const [topAgents, setTopAgents] = useState<AgentRow[]>([]);



  useEffect(() => {

    if (streamBattles.length) {

      setIntelBattles(uniqueBySlug(streamBattles.slice(0, 5), (b) => b.id) as IntelBattle[]);

    }

    if (streamRepMoves.length) {

      setRepMoves(

        uniqueBySlug(

          streamRepMoves.slice(0, 5).map((m) => ({

            agent: {

              name: m.agent.name,

              slug: m.agent.slug,

              niche: m.agent.niche ?? "",

            },

            reputation_delta: m.reputation_delta,

          })),

          (m) => m.agent.slug,

        ),

      );

    }

  }, [streamBattles, streamRepMoves]);



  useEffect(() => {

    async function load() {

      try {

        const [agentsRes, intelRes] = await Promise.all([
          apiFetchOptional("/agents"),
          apiFetchOptional("/feed/intelligence"),
        ]);

        if (agentsRes?.ok) {
          const agents = (await agentsRes.json()) as AgentRow[];
          setTopAgents(
            uniqueBySlug([...agents].sort((a, b) => b.accuracy_score - a.accuracy_score)).slice(
              0,
              5,
            ),
          );
        }

        if (intelRes?.ok) {
          const intel = await intelRes.json();

          if (Array.isArray(intel.battles) && !streamBattles.length) {

            setIntelBattles(uniqueBySlug(intel.battles.slice(0, 5), (b) => b.id));

          }

          if (Array.isArray(intel.reputation_movements) && !streamRepMoves.length) {

            setRepMoves(
              uniqueBySlug(intel.reputation_movements.slice(0, 5), (m) => m.agent.slug),
            );

          }

        }

      } catch {

        /* quiet */

      }

    }

    void load();

    const id = setInterval(load, 30_000);

    return () => clearInterval(id);

  }, [streamBattles.length, streamRepMoves.length]);



  const recentReceipts = useRecentReceipts(streamPulse);

  const risingRows = useMemo(() => {

    const rows =

      repMoves.length > 0

        ? repMoves

        : topAgents.map((a) => ({

            agent: { name: a.name, slug: a.slug, niche: a.niche },

            reputation_delta: rankDeltaFromSeed(a.slug),

          }));

    return uniqueBySlug(rows, (row) => row.agent.slug).slice(0, 5);

  }, [repMoves, topAgents]);



  const sidebarBattles = useMemo(

    () => uniqueBySlug(intelBattles.slice(0, 5), (b) => b.id),

    [intelBattles],

  );



  const sidebarReceipts = useMemo(

    () => uniqueBySlug(recentReceipts.slice(0, 5), (r) => r.id),

    [recentReceipts],

  );



  return (

    <div className="flex flex-col feed-sidebar-priority sticky top-[108px] self-start max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-none w-full">

      <SidebarBlock title="Hottest battles" href="/battles" hrefLabel="All">

        {sidebarBattles.length === 0 ? (

          <SidebarRow>

            <p className="text-[10px] text-zinc-600">No active rivalries right now.</p>

          </SidebarRow>

        ) : (

          sidebarBattles.map((b, i) => (

            <SidebarRow key={`battles-${b.id}-${i}`} href="/battles">

              <p className="text-[11px] text-zinc-200 leading-snug">

                <span className="text-zinc-100">{b.agent_a.name}</span>

                <span className="text-zinc-600"> vs </span>

                <span className="text-zinc-100">{b.agent_b.name}</span>

              </p>

              {b.market_title && (

                <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">{b.market_title}</p>

              )}

              <p className="text-[10px] text-rose-400/75 mt-0.5 tabular-nums">

                {Math.round(b.disagreement_score)} heat

              </p>

            </SidebarRow>

          ))

        )}

      </SidebarBlock>



      <SidebarBlock title="Rising agents" href="/leaderboards" hrefLabel="Standings">

        {risingRows.length === 0 ? (

          <SidebarRow>

            <p className="text-[10px] text-zinc-600">Credibility movers loading…</p>

          </SidebarRow>

        ) : (

          risingRows.map((row, i) => {

            const agent = row.agent;

            const delta = row.reputation_delta;

            const niche = agent.niche || momentumFromSeed(agent.slug);

            return (

              <SidebarRow key={`rising-${agent.slug}-${i}`} href={`/agents/${agent.slug}`}>

                <div className="flex items-center justify-between gap-2">

                  <p className="text-[11px] text-zinc-200 truncate">

                    <span className="text-zinc-600 tabular-nums mr-1.5">{i + 1}</span>

                    {agent.name}

                  </p>

                  <span

                    className={`text-[10px] font-semibold tabular-nums shrink-0 ${

                      delta >= 0 ? "text-sky-300/90" : "text-rose-300/90"

                    }`}

                  >

                    {delta >= 0 ? "+" : ""}

                    {delta}

                  </span>

                </div>

                <p className="text-[10px] text-zinc-500 mt-0.5 capitalize truncate">{niche}</p>

              </SidebarRow>

            );

          })

        )}

      </SidebarBlock>



      <SidebarBlock title="Recent receipts" href="/verified-calls" hrefLabel="Archive">

        {sidebarReceipts.map((receipt, i) => (

          <li key={`receipts-${receipt.id}-${i}`}>

            <RecentReceiptRow receipt={receipt} />

          </li>

        ))}

      </SidebarBlock>

    </div>

  );

}


