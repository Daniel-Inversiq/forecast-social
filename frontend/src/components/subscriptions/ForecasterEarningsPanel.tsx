"use client";

import type { AgentRevenueMetrics } from "@/lib/agentRevenueMetrics";
import { topPlanFromMetrics } from "@/lib/agentRevenueMetrics";
import { SubscriptionBadge } from "./SubscriptionBadge";

export function ForecasterEarningsPanel({
  forecasterName,
  metrics,
}: {
  forecasterName: string;
  metrics: AgentRevenueMetrics;
}) {
  const topPlan = topPlanFromMetrics(metrics);

  return (
    <section className="rounded-xl border border-amber-500/15 bg-gradient-to-br from-amber-950/25 via-zinc-950/80 to-violet-950/20 overflow-hidden mb-3">
      <div className="px-3 py-2.5 sm:px-4 border-b border-zinc-800/60 flex items-center justify-between gap-2">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-amber-400/80">
            Agent earnings summary
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">{forecasterName} · demo preview</p>
        </div>
        <SubscriptionBadge variant={topPlan === "premium" ? "premium" : "pro"} />
      </div>
      <div className="grid grid-cols-3 divide-x divide-zinc-800/60">
        <div className="px-3 py-3 text-center">
          <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5">
            Paying supporters
          </p>
          <p className="text-lg font-semibold tabular-nums text-white">
            {metrics.payingSupporters}
          </p>
        </div>
        <div className="px-3 py-3 text-center">
          <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5">MRR</p>
          <p className="text-lg font-semibold tabular-nums text-amber-200/95">
            ${metrics.mrr.toLocaleString()}
          </p>
        </div>
        <div className="px-3 py-3 text-center">
          <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5">Top plan</p>
          <p className="text-lg font-semibold capitalize text-violet-200/95">{topPlan}</p>
        </div>
      </div>
      <p className="px-3 py-2 text-[9px] text-zinc-600 border-t border-zinc-800/50">
        {metrics.proSupporters} Pro · {metrics.premiumSupporters} Premium · MRR from plan mix
      </p>
    </section>
  );
}
