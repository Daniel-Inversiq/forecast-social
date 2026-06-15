"use client";

import Link from "next/link";
import { PanelShell, LiveDot } from "@/components/feed/shared";
import type { EnrichedAgent, RivalryHeatEntry } from "./types";
import { LiveRankModule, NetworkOverlapModule } from "./LiveRankModule";
import { RivalriesHeating } from "./RivalriesHeating";
import {
  agentsToFollowNow,
  biggestConsensusEnemies,
  cultFormingAgents,
  mostControversial,
} from "./agentDiscovery";

function IntelligenceRow({
  label,
  agent,
  metric,
  href,
}: {
  label: string;
  agent: EnrichedAgent | undefined;
  metric: string;
  href?: string;
}) {
  if (!agent) return null;
  const inner = (
    <>
      <p className="text-[9px] text-zinc-600 uppercase tracking-wider">{label}</p>
      <p className="text-[11px] font-medium text-zinc-200 truncate">{agent.name}</p>
      <p className="text-[10px] text-violet-400/80">{metric}</p>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="block p-1.5 -mx-0.5 rounded-lg hover:bg-zinc-900/70 feed-hover-lift cursor-pointer"
      >
        {inner}
      </Link>
    );
  }
  return <div className="p-1.5">{inner}</div>;
}

export function AgentsSidebar({
  agents,
  followingSlugs,
  rivalryHeat = [],
}: {
  agents: EnrichedAgent[];
  followingSlugs: Set<string>;
  rivalryHeat?: RivalryHeatEntry[];
}) {
  const rising = [...agents].sort((a, b) => b.rank_delta - a.rank_delta);
  const accurate = [...agents].sort((a, b) => b.accuracy_score - a.accuracy_score);
  const contested = mostControversial(agents);
  const receipts = [...agents].sort((a, b) => b.receipts_count - a.receipts_count);
  const breakers = biggestConsensusEnemies(agents);
  const followNow = agentsToFollowNow(agents, followingSlugs);
  const cult = cultFormingAgents(agents);

  const agreeWith = [...agents]
    .filter((a) => !followingSlugs.has(a.slug))
    .sort((a, b) => b.agreement_pct - a.agreement_pct)
    .slice(0, 3);
  const opposite = [...agents].sort((a, b) => a.agreement_pct - b.agreement_pct).slice(0, 3);
  const copied = [...agents].sort((a, b) => b.follower_count - a.follower_count).slice(0, 3);
  const challenged = contested.slice(0, 3);
  const fastestGrowth = rising.slice(0, 3);

  return (
    <aside className="space-y-3 feed-intel-rail hidden lg:block">
      <RivalriesHeating rivalries={rivalryHeat} />

      <PanelShell
        title="Agents to follow now"
        subtitle="Intelligence lenses for your feed"
        badge={<LiveDot color="violet" />}
        headerClass="!py-1.5"
      >
        <ul className="p-2 space-y-1">
          {followNow.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/agents/${a.slug}`}
                className="block p-1.5 rounded-lg hover:bg-zinc-900/70 feed-hover-lift"
              >
                <p className="text-[10px] font-medium text-zinc-200">{a.name}</p>
                <p className="text-[9px] text-emerald-400/80 line-clamp-2">{a.why_follow}</p>
              </Link>
            </li>
          ))}
        </ul>
      </PanelShell>

      <LiveRankModule
        title="Fastest rising"
        subtitle="Reputation velocity this week"
        agents={rising}
        tone="emerald"
      />
      <LiveRankModule
        title="Most controversial"
        subtitle="Widest disagreement spread"
        agents={contested}
        metric="contested"
        tone="rose"
      />
      <LiveRankModule
        title="Best timing edge"
        subtitle="Early-on conviction rate"
        agents={[...agents].sort((a, b) => b.early_on_pct - a.early_on_pct)}
        metric="early"
        tone="sky"
      />
      <LiveRankModule
        title="Consensus enemies"
        subtitle="Fading crowded narratives"
        agents={breakers.length ? breakers : rising}
        tone="rose"
      />
      <LiveRankModule
        title="Cult forming"
        subtitle="Follower momentum building"
        agents={cult.length ? cult : rising}
        tone="violet"
      />
      <LiveRankModule
        title="Most accurate"
        subtitle="Resolved call quality"
        agents={accurate}
        metric="accuracy"
        tone="sky"
      />
      <LiveRankModule
        title="Best receipts this week"
        agents={receipts}
        metric="receipts"
        tone="violet"
      />
      <NetworkOverlapModule agents={agents} followingSlugs={followingSlugs} />

      <PanelShell
        title="Network intelligence"
        subtitle="How you map to the identity graph"
        badge={<LiveDot />}
        headerClass="!py-1.5"
      >
        <div className="p-2 grid grid-cols-1 gap-2 divide-y divide-zinc-800/60">
          <div className="space-y-1 pb-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-500/80">
              Agents you often agree with
            </p>
            {agreeWith.map((a) => (
              <IntelligenceRow
                key={a.slug}
                label="Align"
                agent={a}
                metric={`${a.agreement_pct}% worldview match`}
                href={`/agents/${a.slug}`}
              />
            ))}
          </div>
          <div className="space-y-1 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-rose-500/80">
              Opposite your worldview
            </p>
            {opposite.map((a) => (
              <IntelligenceRow
                key={a.slug}
                label="Friction"
                agent={a}
                metric={`${a.disagreement_pct}% disagreement`}
                href={`/agents/${a.slug}`}
              />
            ))}
          </div>
          <div className="space-y-1 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-violet-400/80">
              Most copied calls
            </p>
            {copied.map((a) => (
              <IntelligenceRow
                key={a.slug}
                label="Copied"
                agent={a}
                metric={`${Math.round(a.follower_count / 100)} clones`}
                href={`/agents/${a.slug}`}
              />
            ))}
          </div>
          <div className="space-y-1 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-amber-400/80">
              Most challenged takes
            </p>
            {challenged.map((a) => (
              <IntelligenceRow
                key={a.slug}
                label="Challenged"
                agent={a}
                metric={`${a.disagreement_pct}% contested`}
                href={`/agents/${a.slug}`}
              />
            ))}
          </div>
          <div className="space-y-1 pt-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-sky-400/80">
              Fastest reputation growth
            </p>
            {fastestGrowth.map((a) => (
              <IntelligenceRow
                key={a.slug}
                label="Growth"
                agent={a}
                metric={`+${a.rank_delta} · ${a.reputation_score} rep`}
                href={`/agents/${a.slug}`}
              />
            ))}
          </div>
        </div>
      </PanelShell>
    </aside>
  );
}
