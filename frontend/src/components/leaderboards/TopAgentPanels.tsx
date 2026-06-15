"use client";

import Link from "next/link";
import { Avatar, MiniProbBar, PanelShell } from "@/components/feed/shared";
import { Sparkline } from "@/components/agents/Sparkline";
import { ReputationScore } from "@/components/reputation/ReputationScore";
import { buildCredibilityFromRankedAgent } from "@/lib/credibilityScore";
import { NarrativeChip } from "@/components/agents/NarrativeChip";
import type { LeaderboardsData, RankedAgent } from "./types";

function ProfilePanel({
  agent,
  verifiedCall,
  following,
  onToggleFollow,
}: {
  agent: RankedAgent;
  verifiedCall?: LeaderboardsData["best_recent_calls"][0];
  following: boolean;
  onToggleFollow: () => void;
}) {
  const sparkTone =
    agent.trend === "up" ? "emerald" : agent.trend === "down" ? "amber" : "violet";

  return (
    <article className="relative rounded-xl border border-zinc-800/85 bg-zinc-950/90 overflow-hidden feed-hover-lift group">
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-violet-950/35 to-transparent pointer-events-none" />
      <div className="relative p-3 sm:p-4">
        <div className="flex items-start gap-3 mb-3">
          <Avatar name={agent.name} color={agent.avatar_color} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/agents/${agent.slug}`}
                  className="text-sm font-semibold text-white hover:text-violet-200 transition truncate block"
                >
                  {agent.name}
                </Link>
                <p className="text-[10px] text-zinc-500">@{agent.slug} · #{agent.rank}</p>
              </div>
              <ReputationScore
                data={buildCredibilityFromRankedAgent(agent)}
                variant="card"
                followers={agent.follower_count}
              />
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">{agent.conviction_profile}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2 py-1.5">
            <p className="text-[8px] uppercase tracking-wider text-zinc-600">Accuracy</p>
            <p className="text-xs font-semibold text-emerald-300/90 tabular-nums">{agent.accuracy_score}%</p>
          </div>
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2 py-1.5">
            <p className="text-[8px] uppercase tracking-wider text-zinc-600">Battle WR</p>
            <p className="text-xs font-semibold text-rose-300/90 tabular-nums">{agent.battle_win_rate}%</p>
          </div>
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2 py-1.5">
            <p className="text-[8px] uppercase tracking-wider text-zinc-600">Tracking</p>
            <p className="text-xs font-semibold text-zinc-300 tabular-nums">
              {(agent.tracking_count / 1000).toFixed(1)}k
            </p>
          </div>
        </div>

        <div className="mb-3">
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-1">Reputation curve</p>
          <Sparkline seed={agent.slug + "-curve"} tone={sparkTone} width={280} height={36} />
        </div>

        <div className="mb-3">
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-1">Strongest markets</p>
          <p className="text-[11px] text-zinc-300 truncate">{agent.strongest_market}</p>
        </div>

        <div className="mb-3 flex flex-wrap gap-1">
          <NarrativeChip label={agent.strongest_narrative} compact tone="violet" />
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-800/80 text-zinc-500 border border-zinc-700/50">
            {agent.niche}
          </span>
        </div>

        {verifiedCall && (
          <div className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-2.5 py-2">
            <p className="text-[8px] uppercase tracking-wider text-emerald-400/80 mb-0.5">
              Recent verified call
            </p>
            <p className="text-[11px] text-zinc-200 line-clamp-1">{verifiedCall.title}</p>
            <p className="text-[9px] text-zinc-600 truncate">{verifiedCall.market_title}</p>
          </div>
        )}

        <div className="mb-3">
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-1">Alignment</p>
          <MiniProbBar value={agent.agreement_pct} size="xs" />
        </div>

        <div className="flex items-center gap-2 relative z-[1]">
          <Link
            href={`/agents/${agent.slug}`}
            className="flex-1 text-center text-[11px] py-1.5 rounded-lg border border-violet-500/25 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20 transition"
          >
            View profile
          </Link>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onToggleFollow();
            }}
            className={`text-[11px] px-3 py-1.5 rounded-lg border transition ${
              following
                ? "border-zinc-600 text-zinc-400 bg-zinc-800/60"
                : "border-emerald-500/30 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20"
            }`}
          >
            {following ? "Tracking" : "Track"}
          </button>
        </div>
      </div>
    </article>
  );
}

export function TopAgentPanels({
  agents,
  leaderboardData,
  followed,
  onToggleFollow,
}: {
  agents: RankedAgent[];
  leaderboardData: LeaderboardsData;
  followed: Set<string>;
  onToggleFollow: (slug: string) => void;
}) {
  const top = agents.slice(0, 3);
  const callBySlug = new Map(
    leaderboardData.best_recent_calls.map((c) => [c.agent.slug, c]),
  );

  return (
    <section className="mt-6">
      <div className="flex items-center gap-2 mb-3 px-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Power profiles
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-zinc-800 to-transparent" />
        <span className="text-[10px] text-zinc-600">Institutional scouting layer</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {top.map((agent) => (
          <ProfilePanel
            key={agent.slug}
            agent={agent}
            verifiedCall={callBySlug.get(agent.slug)}
            following={followed.has(agent.slug)}
            onToggleFollow={() => onToggleFollow(agent.slug)}
          />
        ))}
      </div>

      <div className="mt-4 hidden md:block">
        <PanelShell
          title="Network reputation pulse"
          subtitle="Calibration and conviction strength across ranked layer"
          headerClass="!py-1.5"
        >
          <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Avg reputation",
                value: Math.round(
                  agents.reduce((s, a) => s + a.reputation_score, 0) / Math.max(agents.length, 1),
                ),
              },
              {
                label: "Verified layer",
                value: agents.filter((a) => a.verified_calls >= 12).length,
              },
              {
                label: "Rising now",
                value: agents.filter((a) => a.trend === "up").length,
              },
              {
                label: "Contrarian wins",
                value: Math.max(...agents.map((a) => a.contrarian_wins), 0),
              },
            ].map((m) => (
              <div key={m.label} className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2.5 py-2">
                <p className="text-[8px] uppercase tracking-wider text-zinc-600">{m.label}</p>
                <p className="text-sm font-semibold text-violet-200 tabular-nums">{m.value}</p>
              </div>
            ))}
          </div>
        </PanelShell>
      </div>
    </section>
  );
}
