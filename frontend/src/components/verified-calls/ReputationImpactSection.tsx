"use client";

import Link from "next/link";
import { ReputationTierBadge } from "@/components/reputation/ReputationTierBadge";
import type { EnrichedVerifiedCall } from "./types";

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2 py-1.5">
      <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5">{label}</p>
      <p className="text-[11px] font-semibold text-zinc-100 tabular-nums">{value}</p>
      {sub && <p className="text-[9px] text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export function ReputationImpactSection({ call }: { call: EnrichedVerifiedCall }) {
  const delta = call.reputation_delta;
  const timingMult = call.timing_multiplier;
  const convMult = call.conviction_multiplier;
  const calImpact = call.calibration_impact;
  const timingQ = call.timing_quality;

  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/15 px-2.5 py-2 mb-2 z-[1] relative">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[8px] uppercase tracking-wider text-emerald-500/80 font-semibold">
          Reputation impact
        </p>
        {call.reputation_from_engine ? (
          <span className="text-[8px] text-emerald-400/70 border border-emerald-500/20 px-1 py-0.5 rounded">
            Live engine
          </span>
        ) : (
          <span className="text-[8px] text-zinc-600">Estimated</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span
          className={`text-sm font-bold tabular-nums ${
            delta >= 0 ? "text-emerald-300" : "text-rose-300"
          }`}
        >
          {delta >= 0 ? "+" : ""}
          {delta} reputation
        </span>
        {call.tier_key && call.tier_label && (
          <ReputationTierBadge tierKey={call.tier_key} tierLabel={call.tier_label} compact />
        )}
        {call.consensus_breaking && (
          <span className="text-[8px] font-medium text-fuchsia-300/90 border border-fuchsia-500/25 bg-fuchsia-500/10 px-1.5 py-0.5 rounded-full">
            Consensus-breaking
          </span>
        )}
      </div>

      {call.tier_impact && (
        <p className="text-[10px] text-amber-200/80 mb-2">{call.tier_impact}</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
        <Metric
          label="Timing quality"
          value={timingMult != null ? `×${timingMult}` : timingQ != null ? `${Math.round(timingQ)}` : "—"}
          sub={timingQ != null ? `${Math.round(timingQ)} agent score` : `${call.days_early}d early`}
        />
        <Metric
          label="Calibration"
          value={calImpact != null ? (calImpact >= 0 ? `+${calImpact}` : String(calImpact)) : "—"}
          sub="resolution impact"
        />
        <Metric
          label="Conviction"
          value={convMult != null ? `×${convMult}` : `${Math.round(call.confidence)}%`}
          sub="multiplier"
        />
        <Metric
          label="Consensus"
          value={call.consensus_breaking ? "Broke" : "Aligned"}
          sub={call.consensus_breaking ? "contrarian path" : "with crowd"}
        />
      </div>

      <p className="text-[10px] text-zinc-300 leading-snug">{call.reputation_impact}</p>
      <p className="text-[9px] text-emerald-400/75 mt-1.5">{call.reputation_impact_summary}</p>

      <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-zinc-800/50 text-[9px]">
        <Link href={`/agents/${call.agent_slug}`} className="text-violet-300/90 hover:text-violet-200">
          Agent profile →
        </Link>
        <Link href={`/markets/${call.market_slug}`} className="text-violet-300/90 hover:text-violet-200">
          Market page →
        </Link>
        {call.reputation_from_engine && (
          <Link href="/reputation" className="text-emerald-400/80 hover:text-emerald-300 ml-auto">
            Reputation ledger →
          </Link>
        )}
      </div>
    </div>
  );
}
