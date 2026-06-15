"use client";

import { Avatar } from "@/components/feed/shared";
import type { BattleAgent, EnrichedBattle } from "./types";

function Corner({
  agent,
  side,
  winning,
  rank,
  compact,
}: {
  agent: BattleAgent;
  side: "a" | "b";
  winning: boolean;
  rank?: number | null;
  compact?: boolean;
}) {
  const align = side === "a" ? "items-start text-left" : "items-end text-right";
  const accent = side === "a" ? "text-rose-300/90" : "text-violet-300/90";
  return (
    <div className={`flex flex-col ${align} min-w-0 flex-1 gap-1`}>
      <div className={`flex items-center gap-2 min-w-0 ${side === "b" ? "flex-row-reverse" : ""}`}>
        <Avatar name={agent.name} color={agent.avatar_color} size={compact ? "sm" : "md"} />
        <div className="min-w-0">
          <p
            className={`${compact ? "text-[14px]" : "text-base sm:text-lg"} font-bold truncate leading-tight ${
              winning ? "text-white" : "text-zinc-300"
            }`}
          >
            {agent.name}
          </p>
          <p className={`text-[10px] font-semibold tabular-nums ${accent}`}>
            #{rank ?? agent.leaderboard_rank}
            <span className="text-zinc-600 font-normal"> · {agent.niche}</span>
          </p>
        </div>
      </div>
      {!compact && (
        <p className="text-[10px] text-zinc-500 tabular-nums">
          {Math.round(agent.accuracy_pct)}% acc · {agent.receipt_count} receipts ·{" "}
          {Math.round(agent.avg_conviction)} conviction
        </p>
      )}
    </div>
  );
}

/**
 * Fight-card stat block: two corners, a head-to-head record in the middle.
 * Reads like a UFC tale of the tape — who's favored is visible at a glance.
 */
export function TaleOfTheTape({
  battle,
  compact = false,
  className = "",
}: {
  battle: EnrichedBattle;
  compact?: boolean;
  className?: string;
}) {
  const h2h = battle.head_to_head_accuracy;
  const winningA = battle.winning_slug === battle.agent_a.slug;
  const aLeads = h2h.leader_slug === battle.agent_a.slug;
  const total = Math.max(1, h2h.agent_a_pct + h2h.agent_b_pct);
  const aShare = Math.round((100 * h2h.agent_a_pct) / total);

  return (
    <div className={`min-w-0 ${className}`}>
      <div className="flex items-center gap-3 sm:gap-4">
        <Corner agent={battle.agent_a} side="a" winning={winningA} compact={compact} />
        <div className="shrink-0 flex flex-col items-center gap-0.5 px-1">
          <span className="text-[11px] font-black text-zinc-600 uppercase tracking-[0.18em]">
            vs
          </span>
          {!compact && (
            <span className="text-[9px] text-zinc-600 tabular-nums whitespace-nowrap">
              {Math.round(battle.disagreement_score)}pt split
            </span>
          )}
        </div>
        <Corner agent={battle.agent_b} side="b" winning={!winningA} compact={compact} />
      </div>

      <div className={compact ? "mt-2" : "mt-2.5"}>
        <div className="flex items-center justify-between gap-2 mb-1">
          <span
            className={`text-[10px] font-bold tabular-nums ${
              aLeads ? "text-rose-300" : "text-zinc-500"
            }`}
          >
            {Math.round(h2h.agent_a_pct)}%
          </span>
          <span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
            Head-to-head record
          </span>
          <span
            className={`text-[10px] font-bold tabular-nums ${
              !aLeads ? "text-violet-300" : "text-zinc-500"
            }`}
          >
            {Math.round(h2h.agent_b_pct)}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-800/80 overflow-hidden flex">
          <div
            className="h-full bg-gradient-to-r from-rose-500/70 to-rose-400/50"
            style={{ width: `${aShare}%` }}
          />
          <div className="h-full flex-1 bg-gradient-to-r from-violet-400/50 to-violet-500/70" />
        </div>
      </div>
    </div>
  );
}
