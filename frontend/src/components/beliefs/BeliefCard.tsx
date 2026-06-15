"use client";

import Link from "next/link";
import { HeatPill, LiveDot } from "@/components/feed/shared";
import { beliefPath } from "./beliefEnrichment";
import type { EnrichedBelief } from "./types";

const STATUS: Record<
  EnrichedBelief["status"],
  { label: string; className: string }
> = {
  active: { label: "Active", className: "text-emerald-300/90 bg-emerald-500/10 border-emerald-500/25" },
  resolving: { label: "Resolving", className: "text-amber-200 bg-amber-500/10 border-amber-500/30" },
  resolved: { label: "Resolved", className: "text-zinc-400 bg-zinc-500/10 border-zinc-500/25" },
  dormant: { label: "Dormant", className: "text-zinc-500 bg-zinc-800/40 border-zinc-700/40" },
};

export function BeliefCard({ belief }: { belief: EnrichedBelief }) {
  const status = STATUS[belief.status];
  const topAgents = belief.champions.slice(0, 3).map((c) => c.name);

  return (
    <Link
      href={beliefPath(belief.slug)}
      className="block rounded-xl border border-amber-500/20 bg-zinc-950/80 p-4 transition feed-hover-lift hover:border-amber-500/35"
    >
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {belief.status === "active" && <LiveDot color="amber" />}
        <HeatPill tone="amber">{belief.category}</HeatPill>
        <span
          className={`text-[9px] px-2 py-0.5 rounded-full border ${status.className}`}
        >
          {status.label}
        </span>
        {belief.is_rising && (
          <span className="text-[9px] text-amber-300/90">↑ Rising</span>
        )}
      </div>

      <h3 className="text-sm font-semibold text-white leading-snug">{belief.title}</h3>
      <p className="text-[10px] text-zinc-500 mt-1 line-clamp-1">
        vs {belief.opposing_belief_title}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[10px]">
        <div>
          <p className="text-zinc-600 uppercase tracking-wider text-[9px]">Agents</p>
          <p className="text-zinc-200 tabular-nums">{belief.supporting_agent_count}</p>
        </div>
        <div>
          <p className="text-zinc-600 uppercase tracking-wider text-[9px]">Credibility</p>
          <p className="text-amber-200/90 tabular-nums font-medium">
            {belief.supporting_credibility.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-zinc-600 uppercase tracking-wider text-[9px]">Win rate</p>
          <p className="text-zinc-200 tabular-nums">{belief.historical_win_rate}%</p>
        </div>
        <div>
          <p className="text-zinc-600 uppercase tracking-wider text-[9px]">Followers</p>
          <p className="text-zinc-200 tabular-nums">
            {(belief.follower_count / 1000).toFixed(1)}k
          </p>
        </div>
      </div>

      {topAgents.length > 0 && (
        <p className="text-[10px] text-zinc-500 mt-2 truncate">
          Champions: {topAgents.join(" · ")}
        </p>
      )}
    </Link>
  );
}
