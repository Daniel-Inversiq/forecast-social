"use client";

import Link from "next/link";
import {
  Avatar,
  MiniSparkline,
  RankMotion,
} from "@/components/feed/shared";
import { ReputationScore } from "@/components/reputation/ReputationScore";
import { buildCredibilityFromRankedAgent } from "@/lib/credibilityScore";
import {
  formatActivitySummary,
  formatWeeklyCredibility,
  weeklyCredibilityChange,
} from "@/lib/leaderboardActivity";
import { inferStatusLabel, prestigeTier } from "./leaderboardEnrichment";
import type { RankedAgent, StatusLabel } from "./types";

const STATUS_STYLE: Record<StatusLabel, string> = {
  RISING: "text-emerald-300/90 border-emerald-500/25 bg-emerald-500/8",
  COOLING: "text-rose-300/90 border-rose-500/25 bg-rose-500/8",
  DOMINANT: "text-amber-200/90 border-amber-500/30 bg-amber-500/10",
  FRAGMENTING: "text-zinc-400 border-zinc-600/40 bg-zinc-800/50",
  VERIFIED: "text-sky-200/90 border-sky-500/25 bg-sky-500/8",
  CONTRARIAN: "text-fuchsia-200/90 border-fuchsia-500/25 bg-fuchsia-500/8",
  "CONSENSUS LED": "text-violet-200/90 border-violet-500/25 bg-violet-500/8",
  "NETWORK MOVER": "text-teal-200/90 border-teal-500/25 bg-teal-500/8",
  ISOLATED: "text-zinc-500 border-zinc-700/50 bg-zinc-900/60",
};

const TIER_METAL: Record<string, string> = {
  Emerging: "text-zinc-500",
  Trusted: "text-zinc-400",
  Established: "text-sky-300/80",
  "High Signal": "text-violet-300/90",
  "Network Mover": "text-teal-300/80",
  Elite: "text-amber-200/90",
  Legendary: "text-amber-100",
};

function RankCard({ agent }: { agent: RankedAgent }) {
  const status = inferStatusLabel(agent);
  const tier = prestigeTier(agent);
  const sparkTone =
    agent.trend === "up" ? "emerald" : agent.trend === "down" ? "amber" : "violet";

  return (
    <Link
      href={`/agents/${agent.slug}`}
      className="group relative rounded-xl border border-zinc-800/80 bg-zinc-950/90 overflow-hidden feed-hover-lift hover:border-violet-500/25 transition"
    >
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-violet-950/30 via-zinc-950/20 to-transparent pointer-events-none" />
      <div className="relative p-3 sm:p-3.5">
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg font-bold text-zinc-600 tabular-nums w-7 shrink-0">
              {agent.rank}
            </span>
            <Avatar name={agent.name} color={agent.avatar_color} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate group-hover:text-violet-100">
                {agent.name}
              </p>
              <p className={`text-[9px] uppercase tracking-wider font-medium ${TIER_METAL[tier] ?? TIER_METAL.Emerging}`}>
                {tier}
              </p>
            </div>
          </div>
          <span
            className={`text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${STATUS_STYLE[status]}`}
          >
            {status}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-2.5">
          <div>
            <ReputationScore
              data={buildCredibilityFromRankedAgent(agent)}
              variant="compact"
              className="!text-left [&_*]:!text-left [&_p]:!ml-0"
            />
          </div>
          <div>
            <p className="text-[8px] uppercase tracking-wider text-zinc-600">7d Δ</p>
            <p className="text-sm font-semibold text-emerald-300/90 tabular-nums">
              {formatWeeklyCredibility(weeklyCredibilityChange(agent))?.replace(
                " credibility this week",
                "",
              ) ?? "±0"}
            </p>
          </div>
          <div>
            <p className="text-[8px] uppercase tracking-wider text-zinc-600">Verified</p>
            <p className="text-sm font-semibold text-zinc-300 tabular-nums">{agent.verified_calls}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mb-2">
          <MiniSparkline seed={agent.slug + "card"} tone={sparkTone} width={80} height={18} />
          <p className="text-[10px] text-zinc-500 truncate flex-1 text-right">
            {agent.strongest_narrative}
          </p>
        </div>

        <p className="text-[10px] text-zinc-400 line-clamp-2 leading-snug border-t border-zinc-800/60 pt-2 tabular-nums">
          {formatActivitySummary(agent)}
        </p>

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-zinc-600">
          <span>
            Cal {Math.round(agent.calibration_score ?? agent.accuracy_score)}%
          </span>
          <span>Timing {Math.round(agent.timing_quality ?? agent.early_on_pct)}%</span>
          <span>{agent.streak}w streak</span>
        </div>
      </div>
    </Link>
  );
}

export function RankCards({ agents }: { agents: RankedAgent[] }) {
  const top = agents.slice(0, 6);
  if (!top.length) return null;

  return (
    <section className="mb-4">
      <div className="flex items-center gap-2 mb-2 px-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Institutional hierarchy
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-zinc-800 to-transparent" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {top.map((a) => (
          <RankCard key={a.slug} agent={a} />
        ))}
      </div>
    </section>
  );
}
