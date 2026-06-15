"use client";

import Link from "next/link";
import { formatTimeAgo, HeatPill } from "@/components/feed/shared";
import { titleToSlug } from "@/lib/slugs";
import type { IntelligenceInsight } from "./types";
import { ReputationSparkline } from "./ReputationSparkline";
import { motionClass } from "@/components/feed/motion";

const TYPE_LABEL: Record<string, string> = {
  confidence_shift: "Conviction shift",
  rivalry: "Rivalry",
  receipt: "Receipt",
  consensus_shift: "Consensus shift",
  leaderboard_move: "Reputation move",
  network_cluster: "Network cluster",
  network_split: "Network split",
  macro_shift: "Macro shift",
  narrative_wave: "Narrative wave",
  take: "Take",
};

const TONE_GRADIENT: Record<IntelligenceInsight["tone"], string> = {
  violet: "from-violet-950/50 via-zinc-950/80 to-zinc-950",
  rose: "from-rose-950/45 via-zinc-950/80 to-zinc-950",
  emerald: "from-emerald-950/40 via-zinc-950/80 to-zinc-950",
  sky: "from-sky-950/40 via-zinc-950/80 to-zinc-950",
  amber: "from-amber-950/40 via-zinc-950/80 to-zinc-950",
};

const TONE_BORDER: Record<IntelligenceInsight["tone"], string> = {
  violet: "border-violet-500/20 hover:border-violet-500/35",
  rose: "border-rose-500/25 hover:border-rose-500/40",
  emerald: "border-emerald-500/20 hover:border-emerald-500/35",
  sky: "border-sky-500/20 hover:border-sky-500/35",
  amber: "border-amber-500/20 hover:border-amber-500/35",
};

export function IntelligenceFeedCard({
  insight,
  index = 0,
}: {
  insight: IntelligenceInsight;
  index?: number;
}) {
  const marketHref = insight.market
    ? `/markets/${titleToSlug(insight.market)}`
    : null;

  return (
    <article
      className={`relative rounded-xl border bg-zinc-950/90 overflow-hidden feed-hover-lift feed-card-glow ${TONE_BORDER[insight.tone]} ${motionClass.cardEnterStagger(index)}`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${TONE_GRADIENT[insight.tone]} pointer-events-none opacity-90`}
      />
      <div className="relative p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <HeatPill tone={insight.tone} pulse>
            {TYPE_LABEL[insight.type] ?? "Signal"}
          </HeatPill>
          <span className="text-[9px] text-zinc-600 shrink-0 tabular-nums">
            {formatTimeAgo(insight.created_at, true)}
          </span>
        </div>

        <p className="text-[10px] font-medium text-violet-300/90 mb-1.5 leading-snug">
          {insight.why}
        </p>

        <h3 className="text-sm font-semibold text-white mb-1 leading-snug">{insight.headline}</h3>
        <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">{insight.body}</p>

        <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-zinc-800/60">
          <div className="flex items-center gap-2 min-w-0">
            {insight.conviction != null && (
              <div className="flex-1 max-w-[120px]">
                <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500/80 to-violet-400/60 feed-prob-bar"
                    style={{ width: `${Math.min(100, insight.conviction)}%` }}
                  />
                </div>
                <p className="text-[8px] text-violet-400/80 mt-0.5 tabular-nums">
                  {Math.round(insight.conviction)}% conviction
                </p>
              </div>
            )}
            {insight.agents && (
              <p className="text-[9px] text-zinc-600 truncate">{insight.agents.join(" · ")}</p>
            )}
          </div>
          <ReputationSparkline seed={insight.id} trend="up" width={40} height={12} />
        </div>

        <div className="flex items-center gap-3 mt-2">
          {insight.agent_slug && (
            <Link
              href={`/agents/${insight.agent_slug}`}
              className="text-[10px] text-zinc-500 hover:text-violet-300 transition"
            >
              View agent →
            </Link>
          )}
          {marketHref && (
            <Link
              href={marketHref}
              className="text-[10px] text-zinc-500 hover:text-violet-300 transition truncate"
            >
              {insight.market} →
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
