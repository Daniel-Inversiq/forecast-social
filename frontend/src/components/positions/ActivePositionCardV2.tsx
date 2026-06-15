"use client";

import Link from "next/link";
import {
  HeatPill,
  MiniProbBar,
  MiniSparkline,
  MoveBadge,
} from "@/components/feed/shared";
import { motionClass } from "@/components/feed/motion";
import { NarrativeStateBadge } from "@/components/markets/NarrativeStateBadge";
import { ResolutionHorizonBadge } from "@/components/markets/ResolutionHorizonBadge";
import { AgreementMeter } from "@/components/following/AgreementMeter";
import { PositionLifecycle } from "./PositionLifecycle";
import type { EnrichedActivePosition } from "./types";

const CHIP_STYLE: Record<string, string> = {
  ISOLATED: "text-amber-300 border-amber-500/30 bg-amber-500/10",
  EARLY: "text-teal-300 border-teal-500/30 bg-teal-500/10",
  FRAGMENTING: "text-rose-300 border-rose-500/30 bg-rose-500/10",
  "CONSENSUS BUILDING": "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
  CONTRARIAN: "text-sky-300 border-sky-500/30 bg-sky-500/10",
  "UNDER PRESSURE": "text-rose-300 border-rose-500/30 bg-rose-500/10",
  "RECEIPT FORMING": "text-violet-300 border-violet-500/30 bg-violet-500/10",
  "HIGH CONVICTION": "text-violet-300 border-violet-500/40 bg-violet-500/15",
};

const NETWORK_DIR = {
  toward: { label: "Network → you", class: "text-emerald-400/90" },
  away: { label: "Network ← away", class: "text-rose-400/90" },
  stable: { label: "Network stable", class: "text-zinc-500" },
};

export function ActivePositionCardV2({
  position,
  index = 0,
}: {
  position: EnrichedActivePosition;
  index?: number;
}) {
  const dir = NETWORK_DIR[position.network_direction];
  const pressureHigh = position.pressure_score >= 60;

  return (
    <article
      className={`relative rounded-xl border bg-zinc-950/90 overflow-hidden feed-hover-lift feed-card-glow cursor-pointer ${
        position.contested || pressureHigh
          ? "border-amber-500/25 ring-1 ring-amber-500/10"
          : "border-zinc-800/85"
      } ${motionClass.cardEnterStagger(index)}`}
    >
      <Link
        href={`/markets/${position.slug}`}
        className="absolute inset-0 z-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
        aria-label={`View market: ${position.market_title}`}
      />

      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br ${
          pressureHigh ? "from-rose-950/30" : position.contested ? "from-amber-950/35" : "from-violet-950/25"
        } to-transparent`}
      />

      <div className="relative z-[1] p-3.5 pointer-events-none">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-white leading-snug">{position.market_title}</h3>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {position.resolution_horizon ? (
                <ResolutionHorizonBadge horizon={position.resolution_horizon} size="sm" />
              ) : null}
              <p className="text-[9px] text-zinc-600">{position.time_held_label}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <NarrativeStateBadge state={position.narrative_state} compact />
            <span className={`text-[8px] ${dir.class}`}>{dir.label}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
              position.side === "YES"
                ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
                : "text-rose-300 border-rose-500/30 bg-rose-500/10"
            }`}
          >
            {position.side}
          </span>
          <span className="text-[11px] font-semibold text-violet-300 tabular-nums">
            {position.conviction_strength}%
          </span>
          <span className="text-[9px] text-zinc-600">conviction</span>
          {position.chips.map((chip) => (
            <span
              key={chip}
              className={`text-[7px] font-semibold uppercase px-1 py-0.5 rounded border ${CHIP_STYLE[chip] ?? CHIP_STYLE.CONTRARIAN}`}
            >
              {chip}
            </span>
          ))}
        </div>

        {position.isolation_line && (
          <p className="text-[10px] text-amber-300/90 mb-2 leading-snug border-l-2 border-amber-500/40 pl-2">
            {position.isolation_line}
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 mb-2">
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/50 px-2 py-1.5 col-span-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[8px] text-zinc-600">Consensus</p>
              <MoveBadge delta={position.consensus_drift} />
            </div>
            <div className="flex items-baseline gap-1.5 text-[10px] tabular-nums mb-1">
              <span className="text-zinc-500">{position.entry_probability}%</span>
              <span className="text-zinc-700">→</span>
              <span className="text-white font-semibold">{position.consensus_current}%</span>
            </div>
            <MiniProbBar value={position.current_probability} size="xs" animated={false} />
            <MiniSparkline seed={position.slug} tone={position.consensus_drift >= 0 ? "emerald" : "amber"} width={48} height={12} />
          </div>
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/50 px-2 py-1.5 flex flex-col justify-between">
            <p className="text-[8px] text-zinc-600">Pressure</p>
            <p className={`text-lg font-semibold tabular-nums ${pressureHigh ? "text-rose-400" : "text-amber-300/90"}`}>
              {position.pressure_score}
            </p>
            <p className="text-[8px] text-zinc-700">{position.rep_exposure} rep exp</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2 py-1.5">
            <p className="text-[8px] text-zinc-600 mb-0.5">Network agreement</p>
            <AgreementMeter agree={position.network_agreement} compact />
          </div>
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2 py-1.5">
            <p className="text-[8px] text-zinc-600 mb-0.5">Verification · timing</p>
            <p className="text-[10px] font-semibold text-emerald-400/90 tabular-nums">
              {position.verification_odds}%
            </p>
            <p className="text-[8px] text-zinc-600">edge {position.timing_edge}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-zinc-600">
          <span>
            With:{" "}
            <span className="text-emerald-400/80">{position.supporting_agents.slice(0, 2).join(", ")}</span>
          </span>
          <span>
            Against:{" "}
            <span className="text-rose-400/80">{position.opposing_agents.slice(0, 2).join(", ")}</span>
          </span>
        </div>

        <PositionLifecycle events={position.lifecycle} />
      </div>

      <div className="relative z-[2] px-3.5 py-2 border-t border-zinc-800/70 bg-zinc-950/95 flex items-center justify-between">
        <span className="text-[10px] text-violet-400/90 pointer-events-none">View intelligence →</span>
        {position.verification_odds >= 65 && (
          <HeatPill tone="emerald">Receipt forming</HeatPill>
        )}
      </div>
    </article>
  );
}
