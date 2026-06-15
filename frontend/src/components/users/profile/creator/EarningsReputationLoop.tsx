"use client";

import { SubscriptionBadge } from "@/components/subscriptions/SubscriptionBadge";
import {
  formatReadRevenue,
  type EarningsLeaderboardEntry,
  type EarningsReputationLoopData,
  type IntelligenceInsight,
  type ReadRevenueAttribution,
} from "@/lib/earningsReputationLoop";
import { formatCreatorMrr } from "@/lib/creatorDashboard";
import { CreatorDashboardSection } from "./CreatorDashboardSection";

const INSIGHT_STYLES: Record<IntelligenceInsight["accent"], string> = {
  violet: "border-violet-500/25 bg-violet-950/25",
  amber: "border-amber-500/20 bg-amber-950/20",
  cyan: "border-cyan-500/20 bg-cyan-950/20",
};

function IntelligenceInsightCard({ insight }: { insight: IntelligenceInsight }) {
  return (
    <blockquote
      className={`rounded-xl border px-3 py-2.5 text-[12px] leading-snug text-zinc-200 ${INSIGHT_STYLES[insight.accent]}`}
    >
      <span className="text-violet-400/90 mr-1" aria-hidden>
        ◆
      </span>
      {insight.text}
    </blockquote>
  );
}

function RevenueAttributionRow({ row }: { row: ReadRevenueAttribution }) {
  return (
    <li className="rounded-lg border border-zinc-800/70 bg-zinc-900/35 px-3 py-2.5">
      <p className="text-[12px] font-semibold text-zinc-100 leading-snug">{row.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {row.plans.map((plan) => (
          <span
            key={plan.plan}
            className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500"
          >
            <SubscriptionBadge variant={plan.plan} />
            <span className="tabular-nums">
              {plan.subscribers} · {formatCreatorMrr(plan.revenue)}
            </span>
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 text-[10px] tabular-nums">
        <span className="text-cyan-300/90">
          {row.subscribers} {row.subscribers === 1 ? "subscriber" : "subscribers"}
        </span>
        <span className="text-amber-200/90 font-medium">{formatReadRevenue(row.revenueGenerated)}</span>
      </div>
    </li>
  );
}

function LeaderboardColumn({
  title,
  entries,
}: {
  title: string;
  entries: EarningsLeaderboardEntry[];
}) {
  return (
    <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-2.5 min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-2">{title}</p>
      <ol className="space-y-1.5">
        {entries.map((entry) => (
          <li key={`${title}-${entry.rank}-${entry.title}`} className="flex gap-2">
            <span
              className={`shrink-0 w-5 text-center text-[10px] font-bold tabular-nums ${
                entry.rank === 1
                  ? "text-amber-300"
                  : entry.rank === 2
                    ? "text-zinc-400"
                    : entry.rank === 3
                      ? "text-amber-700/90"
                      : "text-zinc-600"
              }`}
            >
              {entry.rank}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-zinc-200 line-clamp-2 leading-snug">{entry.title}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                <span className="text-violet-300/90 font-medium tabular-nums">{entry.value}</span>
                <span className="mx-1 text-zinc-700">·</span>
                {entry.detail}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function EarningsReputationLoop({ data }: { data: EarningsReputationLoopData }) {
  return (
    <CreatorDashboardSection
      title="Earnings reputation loop"
      hint="How credibility converts into revenue from intelligence"
      accent="amber"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
        {data.insights.map((insight) => (
          <IntelligenceInsightCard key={insight.id} insight={insight} />
        ))}
      </div>

      <div className="pt-3 border-t border-zinc-800/60">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-0.5">
          Revenue attribution
        </p>
        <p className="text-[10px] text-zinc-600 mb-2">
          Source read · subscription plan · revenue generated per intelligence piece
        </p>
        <ul className="space-y-2">
          {data.attributions.map((row) => (
            <RevenueAttributionRow key={row.id} row={row} />
          ))}
        </ul>
      </div>

      <div className="pt-4 mt-4 border-t border-zinc-800/60">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
          Read leaderboards
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <LeaderboardColumn
            title="Top converting reads"
            entries={data.leaderboards.topConverting}
          />
          <LeaderboardColumn
            title="Top subscriber growth"
            entries={data.leaderboards.topSubscriberGrowth}
          />
          <LeaderboardColumn
            title="Highest revenue read"
            entries={data.leaderboards.highestRevenue}
          />
        </div>
      </div>
    </CreatorDashboardSection>
  );
}
