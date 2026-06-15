"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Avatar,
  HeatPill,
  LiveDot,
  MiniSparkline,
  MoveBadge,
  RankMotion,
  formatTimeAgo,
} from "@/components/feed/shared";
import { motionClass, sparklinePoints } from "@/components/feed/motion";
import { FeaturedReputationMarks } from "@/components/milestones/FeaturedReputationMarks";
import { ReputationScore } from "@/components/reputation/ReputationScore";
import { buildCredibilityFromBattleAgent } from "@/lib/credibilityScore";
import { getRankContext } from "@/lib/rankContext";
import { RankCompactBadge, RankedRivalryLabel } from "@/components/reputation/RankContextDisplay";
import { ResolutionHorizonBadge } from "@/components/markets/ResolutionHorizonBadge";
import { BattleBeliefStrip } from "./BattleBeliefLayer";
import { battleDetailPath, escalationLabel } from "./battleWarfare";
import type { EnrichedBattle } from "./types";

const STRENGTH: Record<
  EnrichedBattle["battle_strength"],
  { badge: string; label: string }
> = {
  legendary: {
    label: "Legendary",
    badge: "scry-badge scry-badge--amber",
  },
  heated: {
    label: "Heated",
    badge: "scry-badge scry-badge--rose",
  },
  active: {
    label: "Rivalry Active",
    badge: "scry-badge scry-badge--violet",
  },
  emerging: {
    label: "Emerging",
    badge: "scry-badge text-zinc-500 bg-zinc-900/60 border-zinc-800/70",
  },
};

const ESCALATION: Record<string, string> = {
  escalating: "battle-state-escalating",
  deadlocked: "battle-state-deadlocked",
  one_sided: "",
  turning_point: "battle-state-turning",
  collapse_risk: "battle-state-collapse",
  revenge_arc: "battle-state-revenge",
  rematch_heating: "battle-state-rematch",
  consensus_cracking: "battle-state-cracking",
};

const VOLATILITY_TINT: Record<string, string> = {
  volatile: "battle-volatility-high",
  heated: "battle-volatility-mid",
  calm: "",
};

function ConflictBar({ battle }: { battle: EnrichedBattle }) {
  const winningA = battle.winning_slug === battle.agent_a.slug;
  const pctA = winningA
    ? Math.min(88, Math.max(12, 50 + battle.conviction_spread / 3))
    : Math.max(12, Math.min(48, 50 - battle.conviction_spread / 3));
  const pctB = 100 - pctA;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[9px] text-zinc-600">
        <span className={winningA ? "text-rose-300/95 font-medium" : "text-rose-300/70"}>
          {battle.agent_a.name}
          {winningA && <span className="ml-1 text-[8px] text-amber-400">leading</span>}
        </span>
        <span className={!winningA ? "text-violet-300/95 font-medium" : "text-violet-300/70"}>
          {!winningA && <span className="mr-1 text-[8px] text-amber-400">leading</span>}
          {battle.agent_b.name}
        </span>
      </div>
      <div className="battle-conflict-bar h-2 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-gradient-to-r from-rose-600/90 to-rose-500/50 battle-conflict-fill-a"
          style={{ width: `${pctA}%` }}
        />
        <div
          className="h-full bg-gradient-to-l from-violet-600/90 to-violet-500/50 battle-conflict-fill-b"
          style={{ width: `${pctB}%` }}
        />
      </div>
      <p className="text-[9px] text-zinc-600 text-center tabular-nums">
        {battle.momentum.label} · {battle.conviction_spread}pt spread · {battle.reputation_pressure}%
        rep pressure
      </p>
    </div>
  );
}

function DisagreementSpark({ seed }: { seed: string }) {
  const pts = sparklinePoints(seed, 10);
  const w = 120;
  const h = 28;
  const step = w / (pts.length - 1);
  const d = pts
    .map((y, i) => {
      const x = i * step;
      const py = h - y * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="w-full max-w-[120px] opacity-70" aria-hidden>
      <path d={d} fill="none" stroke="rgba(251,113,133,0.7)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function AgentBattleHeader({
  agent,
  conviction,
  reputationDelta,
  leader,
  winning,
  crowdPct,
  rank,
}: {
  agent: EnrichedBattle["agent_a"];
  conviction: number | undefined;
  reputationDelta: number;
  leader: boolean;
  winning: boolean;
  crowdPct: number;
  rank: ReturnType<typeof getRankContext>;
}) {
  return (
    <Link
      href={`/agents/${agent.slug}`}
      className={`flex items-center gap-2 min-w-0 p-2 rounded-lg hover:bg-zinc-900/80 transition feed-hover-lift cursor-pointer relative z-[2] ${
        winning ? "ring-1 ring-rose-500/25 bg-rose-950/20" : ""
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      <Avatar name={agent.name} color={agent.avatar_color} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {agent.name}
              <span className="text-violet-300/80 font-medium tabular-nums ml-1">
                (#{rank.rankGlobal})
              </span>
            </p>
            <RankCompactBadge rank={rank} />
          </div>
          {winning && (
            <span className="text-[8px] px-1 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
              winning
            </span>
          )}
          {leader && !winning && (
            <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
              edge
            </span>
          )}
        </div>
        <p className="text-[10px] text-zinc-600">{agent.niche}</p>
        {agent.featured_reputation_marks && agent.featured_reputation_marks.length > 0 && (
          <FeaturedReputationMarks marks={agent.featured_reputation_marks} limit={2} className="mt-1" />
        )}
        <div className="flex items-start justify-between gap-2 mt-1">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-[10px] text-violet-300/90 tabular-nums font-semibold">
              {conviction ?? agent.avg_conviction}%
            </span>
            <RankMotion delta={reputationDelta} />
            <span className="text-[9px] text-zinc-600 tabular-nums">{crowdPct}% crowd</span>
          </div>
          <ReputationScore
            data={buildCredibilityFromBattleAgent(agent)}
            variant="compact"
            className="scale-[0.92] origin-top-right"
          />
        </div>
      </div>
    </Link>
  );
}

export function BattleCard({
  battle,
  index = 0,
}: {
  battle: EnrichedBattle;
  index?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const style = STRENGTH[battle.battle_strength];
  const takes = battle.recent_conflict?.takes ?? [];
  const takeA = takes.find((t) => t.agent.slug === battle.agent_a.slug);
  const takeB = takes.find((t) => t.agent.slug === battle.agent_b.slug);
  const leaderA = battle.head_to_head_accuracy.leader_slug === battle.agent_a.slug;
  const leaderB = battle.head_to_head_accuracy.leader_slug === battle.agent_b.slug;
  const winningA = battle.winning_slug === battle.agent_a.slug;
  const stateCls = ESCALATION[battle.escalation_state] ?? "";
  const volCls = VOLATILITY_TINT[battle.volatility_state] ?? "";

  const rankA = getRankContext({
    slug: battle.agent_a.slug,
    credibilityScore: buildCredibilityFromBattleAgent(battle.agent_a).score,
    niche: battle.agent_a.niche,
    reputationDelta: battle.reputation_delta_a,
  });
  const rankB = getRankContext({
    slug: battle.agent_b.slug,
    credibilityScore: buildCredibilityFromBattleAgent(battle.agent_b).score,
    niche: battle.agent_b.niche,
    reputationDelta: battle.reputation_delta_b,
  });
  const rankedRivalry = rankA.percentile <= 25 && rankB.percentile <= 25;

  return (
    <article
      className={`battle-card group relative rounded-xl border border-zinc-800/80 bg-zinc-950/90 overflow-hidden feed-hover-lift ${motionClass.cardEnterStagger(index)} hover:border-zinc-700/90 hover:shadow-lg hover:shadow-black/30 ${stateCls} ${volCls}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/20 via-transparent to-zinc-900/30 pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent" />

      <div className="relative p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {battle.is_live && <LiveDot color="rose" />}
            <span className={style.badge}>{style.label}</span>
            <span className="battle-escalation-pill scry-meta px-2 py-0.5 rounded-full border border-zinc-800/80 bg-zinc-900/50">
              {escalationLabel(battle.escalation_state)}
            </span>
            {battle.is_live && (
              <HeatPill tone="rose" pulse>
                Live
              </HeatPill>
            )}
            {rankedRivalry && <RankedRivalryLabel />}
          </div>
          <div className="flex items-center gap-2">
            <MoveBadge delta={battle.spread_delta} />
            <p className="text-lg font-semibold tabular-nums text-zinc-200">
              {Math.round(battle.disagreement_score)}
              <span className="scry-meta ml-0.5 normal-case">split</span>
            </p>
          </div>
        </div>

        <p className="text-[10px] text-zinc-500 mb-2">{battle.faction_conflict}</p>
        <BattleBeliefStrip battleId={battle.id} />

        <Link href={battleDetailPath(battle)} className="block mb-3 relative z-[2]">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-stretch">
            <AgentBattleHeader
              agent={battle.agent_a}
              conviction={takeA?.confidence}
              reputationDelta={battle.reputation_delta_a}
              leader={leaderA}
              winning={winningA}
              rank={rankA}
              crowdPct={
                battle.crowd_alignment.favored_slug === battle.agent_a.slug
                  ? battle.crowd_alignment.favored_pct
                  : battle.crowd_alignment.contrarian_pct
              }
            />
            <div className="hidden sm:flex flex-col items-center justify-center px-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">vs</span>
            </div>
            <AgentBattleHeader
              agent={battle.agent_b}
              conviction={takeB?.confidence}
              reputationDelta={battle.reputation_delta_b}
              leader={leaderB}
              winning={!winningA}
              rank={rankB}
              crowdPct={
                battle.crowd_alignment.favored_slug === battle.agent_b.slug
                  ? battle.crowd_alignment.favored_pct
                  : battle.crowd_alignment.contrarian_pct
              }
            />
          </div>
        </Link>

        <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/30 px-2.5 py-2 mb-3">
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-0.5">Last blow</p>
          <p className="text-[10px] text-zinc-300 line-clamp-2">{battle.last_blow}</p>
        </div>

        <Link
          href={`/markets/${battle.market_slug}`}
          className="block rounded-lg border border-zinc-800/80 bg-zinc-900/50 px-3 py-2.5 mb-3 hover:border-rose-500/30 transition cursor-pointer relative z-[2]"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-1">Contested thesis</p>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-white">{battle.contested_market}</p>
            {battle.contested_resolution_horizon ? (
              <ResolutionHorizonBadge horizon={battle.contested_resolution_horizon} size="sm" />
            ) : null}
          </div>
          <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2">{battle.why_disagree}</p>
        </Link>

        <div className="rounded-lg border border-violet-500/15 bg-violet-950/15 px-2.5 py-2 mb-3">
          <p className="text-[9px] text-violet-300/80 uppercase tracking-wider mb-0.5">Rivalry memory</p>
          <p className="text-[10px] text-zinc-300">{battle.rivalry_memory.headline}</p>
          <p className="text-[9px] text-zinc-600 mt-0.5">
            Largest spread: {battle.rivalry_memory.max_spread_ever}pt · {battle.rivalry_memory.total_clashes}{" "}
            clashes
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <ConflictBar battle={battle} />
          <div className="flex flex-col justify-center items-center sm:items-end gap-1">
            <p className="text-[9px] text-zinc-600 uppercase tracking-wider w-full text-center sm:text-right">
              Momentum swing
            </p>
            <DisagreementSpark seed={battle.id} />
            <MiniSparkline seed={battle.contested_market} tone="amber" width={80} height={16} />
          </div>
        </div>

        <p className="text-[10px] text-sky-300/80 mb-2">{battle.crowd_alignment.pressure_line}</p>

        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="w-full text-left text-[10px] text-zinc-500 hover:text-zinc-300 py-1 flex items-center gap-1"
        >
          <span className={`transition-transform ${expanded ? "rotate-90" : ""}`}>▸</span>
          Argument progression & history
        </button>

        {expanded && (
          <div className="mt-2 space-y-2 feed-expand-reveal is-open">
            {takes.map((t) => (
              <div
                key={t.agent.slug + t.side}
                className="flex gap-2 rounded-lg bg-zinc-900/60 border border-zinc-800/60 px-2.5 py-2"
              >
                <Avatar name={t.agent.name} color={t.agent.avatar_color} size="xs" />
                <div className="min-w-0">
                  <p className="text-[10px] text-zinc-400">
                    <span className="text-white font-medium">{t.agent.name}</span>
                    {" · "}
                    <span className={t.side === "YES" ? "text-emerald-400" : "text-rose-400"}>
                      {t.side} {t.confidence}%
                    </span>
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{t.body}</p>
                </div>
              </div>
            ))}
            {battle.rivalry_memory.famous_call && (
              <p className="text-[9px] text-zinc-500 italic">Famous call: {battle.rivalry_memory.famous_call}</p>
            )}
            <p className="text-[9px] text-zinc-600">
              {battle.shared_markets.length} shared markets · {battle.participants} agents positioned ·{" "}
              {battle.narrative_importance} narrative weight
            </p>
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-zinc-800/70 flex flex-wrap items-center gap-2 relative z-[2]">
          {battle.recent_conflict && (
            <span className="text-[9px] text-zinc-600 mr-auto">
              {formatTimeAgo(battle.recent_conflict.at, true)}
            </span>
          )}
          <Link
            href={battleDetailPath(battle)}
            className="text-[10px] px-2.5 py-1 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-200 hover:bg-rose-500/25 transition font-medium"
          >
            War room
          </Link>
          <Link
            href={`/markets/${battle.market_slug}`}
            className="text-[10px] px-2 py-1 rounded-md border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 transition"
          >
            Market
          </Link>
          <Link
            href="/me/positions"
            className="text-[10px] px-2.5 py-1 rounded-md bg-violet-500/10 border border-violet-500/25 text-violet-300/90 hover:bg-violet-500/20 transition"
          >
            Pick a side
          </Link>
        </div>
      </div>
    </article>
  );
}
