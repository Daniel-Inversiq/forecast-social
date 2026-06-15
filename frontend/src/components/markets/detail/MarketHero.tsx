"use client";

import Link from "next/link";
import {
  HeatPill,
  LiveDot,
  MoveBadge,
  MomentumIndicator,
  urgencyStyle,
} from "@/components/feed/shared";
import { sparklinePoints } from "@/components/feed/motion";
import { NarrativeStateBadge } from "@/components/markets/NarrativeStateBadge";
import { ResolutionHorizonBadge } from "@/components/markets/ResolutionHorizonBadge";
import { getNarrativeStateStyle } from "@/components/markets/narrativeStateStyles";
import { ReputationConflictBadge } from "@/components/markets/ReputationConflictBadge";
import { ForecastThesisLine } from "@/components/forecast/ForecastThesisLine";
import { isMarketResolved } from "@/lib/resolution";
import type { EnrichedMarketDetail } from "./types";

function ProbabilityCurve({ seed, history }: { seed: string; history: number[] }) {
  const w = 280;
  const h = 56;
  const pts = history.length > 1 ? history : sparklinePoints(seed, 12).map((y) => y * 100);
  const min = Math.min(...pts) - 4;
  const max = Math.max(...pts) + 4;
  const range = max - min || 1;
  const step = w / (pts.length - 1);
  const d = pts
    .map((p, i) => {
      const x = i * step;
      const py = h - ((p - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(" ");
  const fillD = `${d} L${w},${h} L0,${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-14 sm:h-16" aria-hidden>
      <defs>
        <linearGradient id="prob-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(139,92,246,0.35)" />
          <stop offset="100%" stopColor="rgba(139,92,246,0)" />
        </linearGradient>
      </defs>
      <path d={fillD} fill="url(#prob-fill)" />
      <path
        d={d}
        fill="none"
        stroke="rgba(167,139,250,0.9)"
        strokeWidth="2"
        strokeLinecap="round"
        className="feed-sparkline"
      />
    </svg>
  );
}

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

const DOMINANT_LABEL: Record<string, string> = {
  YES: "YES coalition leading",
  NO: "NO bloc controlling narrative",
  split: "No dominant faction",
};

export function MarketHero({ market }: { market: EnrichedMarketDetail }) {
  const resolved = isMarketResolved(market);
  const e = market.enriched;
  const stateStyle = getNarrativeStateStyle(e.narrative_state);
  const urgency = urgencyStyle[market.urgency] ?? urgencyStyle.cooling;
  const prob = resolved && market.resolved_outcome
    ? market.resolved_outcome === "YES"
      ? 100
      : 0
    : Math.round(market.current_yes_probability);

  const heroClass = resolved
    ? "war-room-archival border-emerald-800/40"
    : e.is_hot
      ? "war-room-hero-hot border-rose-500/30"
      : e.glow_intensity === "high"
        ? "war-room-hero-hot"
        : e.glow_intensity === "medium"
          ? "war-room-hero"
          : "border-zinc-800/80";

  const warStats = resolved
    ? [
        { label: "Final outcome", value: market.resolved_outcome ?? "—" },
        { label: "Archive status", value: "Permanent record" },
        { label: "Receipts", value: `${e.receipts_count} verified` },
        { label: "Aftermath", value: e.market_memory.find((m) => m.kind === "settlement")?.text?.slice(0, 28) ?? "Locked" },
      ]
    : [
        { label: "Conviction pressure", value: `${market.market_heat}% heat` },
        { label: "Fragmentation", value: `${market.consensus_fragmentation}%` },
        { label: "Battle intensity", value: `${market.battle_intensity}%` },
        { label: "Rep imbalance", value: `${e.reputation_yes_share}% YES` },
      ];

  return (
    <section
      className={`relative overflow-hidden rounded-xl border bg-zinc-950/90 mb-4 ${heroClass} ${
        stateStyle.fragmented ? "markets-card-fragmented" : ""
      } ${!resolved && e.is_hot ? "markets-card-glow-high" : !resolved && e.glow_intensity === "medium" ? "markets-card-glow-med" : ""}`}
    >
      <div className={`absolute inset-0 pointer-events-none ${stateStyle.atmosphere}`} aria-hidden />
      <div
        className={`absolute inset-0 bg-gradient-to-br ${stateStyle.tint} via-zinc-950/60 to-zinc-950 pointer-events-none`}
        aria-hidden
      />

      <div className="relative p-3 sm:p-4 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href="/markets"
              className="text-[10px] text-zinc-600 hover:text-violet-300 transition mr-1"
            >
              ← Markets
            </Link>
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-zinc-900/90 text-zinc-500 border border-zinc-800/80">
              {market.category}
            </span>
            <NarrativeStateBadge state={e.narrative_state} />
            {!resolved && (
              <ReputationConflictBadge level={e.reputation_conflict} compact />
            )}
            {resolved ? (
              <span className="inline-flex items-center gap-1 text-[8px] font-bold uppercase px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                Institutional archive · {market.resolved_outcome}
              </span>
            ) : (
              <HeatPill tone={market.urgency === "hot" ? "rose" : "violet"} pulse>
                Live war room
              </HeatPill>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!resolved && (
              <LiveDot color={market.urgency === "hot" ? "rose" : "violet"} />
            )}
            <span className="text-[10px] text-zinc-600 capitalize">
              {resolved ? "Conviction archive" : statusLabel(market.status)}
            </span>
          </div>
        </div>

        {!resolved && (
          <p className="text-[11px] sm:text-xs font-medium text-amber-200/90 mb-3 war-room-momentum-pulse leading-relaxed max-w-3xl">
            {market.war_room_line}
          </p>
        )}

        {resolved && (
          <p className="text-[11px] text-emerald-300/80 mb-3 leading-relaxed max-w-3xl">
            This market is part of the network&apos;s permanent conviction archive. Reputation
            aftermath and verified calls remain on the public record.
          </p>
        )}

        <div className="grid lg:grid-cols-[minmax(0,1fr)_auto] gap-5 lg:gap-8 items-end">
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 mb-1.5">
              {resolved ? "Resolved question" : "Live conviction war room"}
            </p>
            <h1 className="text-xl sm:text-2xl lg:text-[1.75rem] font-semibold tracking-tight text-white leading-tight mb-2">
              {market.title}
            </h1>
            <ForecastThesisLine thesis={e.forecast_thesis} className="mb-2 max-w-2xl" />
            {market.resolution_horizon ? (
              <div className="mb-2">
                <ResolutionHorizonBadge horizon={market.resolution_horizon} size="md" prominent />
              </div>
            ) : null}
            <p className="text-xs text-zinc-500 leading-relaxed max-w-2xl">{market.narrative}</p>

            <div className="flex flex-wrap items-center gap-3 mt-4 text-[10px]">
              {!resolved && (
                <>
                  <MoveBadge delta={market.movement_delta} />
                  <MomentumIndicator
                    direction={market.momentum}
                    label={
                      market.momentum === "up"
                        ? "Narrative accelerating"
                        : market.momentum === "down"
                          ? "Pressure easing"
                          : "Stable momentum"
                    }
                  />
                  <span className="text-zinc-700">·</span>
                </>
              )}
              <span
                className={`inline-flex items-center gap-1 text-[8px] font-semibold uppercase px-1.5 py-0.5 rounded-full border capitalize ${urgency.ring} ${urgency.text}`}
              >
                <span className={`h-1 w-1 rounded-full ${urgency.dot}`} />
                {market.urgency}
              </span>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-500">{DOMINANT_LABEL[market.dominant_faction]}</span>
            </div>

            {!resolved && (
              <p className="text-[10px] text-zinc-600 mt-2 italic">{stateStyle.mood}</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch gap-4 shrink-0">
            <div className="text-right sm:text-left lg:text-right">
              <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-0.5">
                {resolved ? "Verified outcome" : "Current probability"}
              </p>
              <p
                className={`text-4xl sm:text-5xl font-semibold tabular-nums leading-none ${
                  resolved ? "text-emerald-300" : "text-violet-300 feed-prob-animate"
                }`}
              >
                {resolved ? market.resolved_outcome : `${prob}%`}
                {!resolved && (
                  <span className="text-sm text-zinc-600 font-normal ml-1.5">YES</span>
                )}
              </p>
              <p className="text-[10px] text-zinc-600 mt-1 max-w-[200px] lg:ml-auto">
                {resolved
                  ? market.resolved_at
                    ? `Settled ${new Date(market.resolved_at).toLocaleDateString()}`
                    : "Outcome locked in archive"
                  : market.timing_pressure}
              </p>
            </div>
            <div className="w-full sm:w-48 lg:w-56 rounded-lg border border-zinc-800/60 bg-zinc-900/30 px-2 py-1.5">
              <ProbabilityCurve seed={market.slug} history={market.prob_history} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-zinc-800/50">
          {warStats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-zinc-800/50 bg-zinc-900/25 px-3 py-2.5"
            >
              <p className="text-[8px] uppercase tracking-wider text-zinc-600">{stat.label}</p>
              <p className="text-sm font-semibold text-zinc-200 tabular-nums mt-1 truncate">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {!resolved && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-600">
            <span>
              Consensus:{" "}
              <span className="text-zinc-400">{100 - market.consensus_fragmentation}% aligned</span>
            </span>
            <span>
              Narrative velocity:{" "}
              <span className="text-zinc-400">{market.narrative_velocity}%</span>
            </span>
            <span>
              Exposure: <span className="text-zinc-400">{market.reputation_exposure}%</span>
            </span>
            <span className="text-violet-400/80">{e.agent_lead_line}</span>
          </div>
        )}
      </div>
    </section>
  );
}
