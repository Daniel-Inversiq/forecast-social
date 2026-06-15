"use client";

import Link from "next/link";
import { Avatar } from "@/components/feed/shared";
import { ReputationTierBadge } from "@/components/reputation/ReputationTierBadge";
import { RankDeltaPill } from "@/components/reputation/RankContextDisplay";
import { buildCredibilityScore } from "@/lib/credibilityScore";
import { getRankContext } from "@/lib/rankContext";
import type { RankedAgent } from "./types";

const PODIUM_ACCENT: Record<number, string> = {
  1: "border-amber-500/35 bg-gradient-to-b from-amber-950/40 to-zinc-950/90 ring-1 ring-amber-500/20",
  2: "border-zinc-500/30 bg-gradient-to-b from-zinc-900/50 to-zinc-950/90",
  3: "border-orange-700/25 bg-gradient-to-b from-orange-950/25 to-zinc-950/90",
};

const ROW_ACCENT: Record<number, string> = {
  1: "text-amber-300",
  2: "text-zinc-300",
  3: "text-orange-300",
};

function formatChange30d(delta: number): string {
  if (delta === 0) return "±0";
  return `${delta > 0 ? "+" : ""}${delta}`;
}

export function ForecasterPlayerCard({
  agent,
  variant = "row",
  tieBreakNote,
}: {
  agent: RankedAgent;
  variant?: "podium" | "row";
  /** Shown when credibility ties with the forecaster ranked directly below. */
  tieBreakNote?: string | null;
}) {
  const credibility = buildCredibilityScore({
    slug: agent.slug,
    score: agent.reputation_score,
    niche: agent.niche,
    trend: agent.trend,
    rankDelta: agent.rank_delta,
    reputationDelta: agent.reputation_delta ?? agent.velocity,
    verifiedCalls: agent.verified_calls,
    resolvedCalls: agent.resolved_calls,
  });
  const rankCtx = getRankContext({
    slug: agent.slug,
    credibilityScore: credibility.score,
    rank: agent.rank,
    rankDelta: agent.rank_delta,
    reputationDelta: agent.reputation_delta,
    niche: agent.niche,
  });
  const change30d = credibility.change30d;
  const changeUp = change30d > 0;
  const changeDown = change30d < 0;
  const isPodium = variant === "podium";
  const podiumClass = PODIUM_ACCENT[agent.rank] ?? "border-zinc-800/80 bg-zinc-950/80";

  return (
    <Link
      href={`/agents/${agent.slug}`}
      className={`group block rounded-xl border transition feed-hover-lift hover:border-violet-500/30 ${
        isPodium ? `p-4 sm:p-5 ${podiumClass}` : "px-3 sm:px-4 py-3 border-zinc-800/70 bg-zinc-950/70 hover:bg-violet-950/10"
      }`}
    >
      <div
        className={
          isPodium
            ? "flex flex-col gap-3"
            : "grid grid-cols-[auto_1fr] sm:grid-cols-[auto_minmax(0,1.4fr)_repeat(5,minmax(0,1fr))] gap-x-3 sm:gap-x-4 gap-y-2 items-center"
        }
      >
        <div className={`flex items-center gap-2.5 sm:gap-3 ${isPodium ? "" : "col-span-2 sm:col-span-1"}`}>
          <span
            className={`font-bold tabular-nums shrink-0 flex flex-col items-center ${
              isPodium ? "text-2xl text-zinc-500 w-9" : `text-sm w-7 ${ROW_ACCENT[agent.rank] ?? "text-zinc-500"}`
            }`}
          >
            #{agent.rank}
            <RankDeltaPill
              rankDelta={rankCtx.rankDelta}
              isNew={rankCtx.isNew}
              className="mt-0.5 scale-90"
            />
          </span>
          <Avatar
            name={agent.name}
            color={agent.avatar_color}
            size={isPodium ? "md" : "sm"}
          />
          <div className="min-w-0 flex-1">
            <p
              className={`font-semibold text-white truncate group-hover:text-violet-100 transition ${
                isPodium ? "text-base sm:text-lg" : "text-sm"
              }`}
            >
              {agent.name}
            </p>
            <div className="flex flex-wrap items-center gap-1 mt-0.5">
              {agent.tier_key && agent.tier_label ? (
                <ReputationTierBadge
                  tierKey={agent.tier_key}
                  tierLabel={agent.tier_label}
                  compact
                />
              ) : (
                <span className="text-[9px] px-1.5 py-0.5 rounded border border-zinc-700/50 text-zinc-500 uppercase tracking-wider">
                  Emerging
                </span>
              )}
              {isPodium && agent.streak > 0 && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded border tabular-nums font-semibold ${
                    agent.streak >= 4
                      ? "border-amber-500/30 text-amber-300 bg-amber-500/10"
                      : "border-zinc-700/60 text-zinc-400"
                  }`}
                >
                  W{agent.streak}
                  {agent.streak >= 4 ? " 🔥" : ""}
                </span>
              )}
            </div>
            {tieBreakNote ? (
              <p className="text-[9px] text-violet-400/75 mt-1 leading-snug tabular-nums">
                {tieBreakNote}
              </p>
            ) : null}
          </div>
        </div>

        <div className={isPodium ? "grid grid-cols-2 sm:grid-cols-4 gap-3" : "contents"}>
          <StatCell
            label="Credibility"
            value={credibility.onboarding?.headline ?? String(credibility.score)}
            highlight
            className={isPodium ? "" : "hidden sm:block"}
          />
          <StatCell
            label="30d change"
            value={formatChange30d(change30d)}
            valueClass={
              changeUp
                ? "text-emerald-300/90"
                : changeDown
                  ? "text-rose-300/90"
                  : "text-zinc-400"
            }
          />
          <StatCell
            label="Resolved calls"
            value={String(agent.resolved_calls)}
            className={isPodium ? "" : "hidden sm:block"}
          />
          <StatCell
            label="Win rate"
            value={`${Math.round(agent.battle_win_rate)}%`}
            className={isPodium ? "" : "hidden lg:block"}
          />
          <StatCell
            label="Streak"
            value={agent.streak > 0 ? `W${agent.streak}` : "—"}
            valueClass={agent.streak >= 4 ? "text-amber-300" : "text-zinc-300"}
            className={isPodium ? "hidden" : "hidden lg:block"}
          />
        </div>

        {!isPodium && (
          <div className="col-span-2 sm:hidden flex justify-between gap-4 text-[10px] tabular-nums border-t border-zinc-800/60 pt-2 mt-1">
            <span>
              <span className="text-zinc-600">Cred </span>
              <span className="text-white font-semibold">
                {credibility.onboarding?.headline ?? credibility.score}
              </span>
            </span>
            <span>
              <span className="text-zinc-600">Resolved </span>
              <span className="text-zinc-300">{agent.resolved_calls}</span>
            </span>
            <span>
              <span className="text-zinc-600">Win </span>
              <span className="text-zinc-300">{Math.round(agent.battle_win_rate)}%</span>
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

function StatCell({
  label,
  value,
  highlight,
  valueClass = "text-white",
  className = "",
}: {
  label: string;
  value: string;
  highlight?: boolean;
  valueClass?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[8px] uppercase tracking-[0.14em] text-zinc-600 mb-0.5">{label}</p>
      <p
        className={`tabular-nums font-semibold ${
          highlight ? "text-lg sm:text-xl text-white" : `text-sm ${valueClass}`
        }`}
      >
        {value}
      </p>
    </div>
  );
}
