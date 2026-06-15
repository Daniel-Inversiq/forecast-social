"use client";

import Link from "next/link";
import { useState } from "react";
import {
  HeatPill,
  LiveDot,
  MiniProbBar,
  MoveBadge,
  urgencyStyle,
} from "@/components/feed/shared";
import { motionClass } from "@/components/feed/motion";
import { AgreementMeter } from "@/components/following/AgreementMeter";
import { isMarketResolved } from "@/lib/resolution";
import type { EnrichedMarket } from "./types";
import { ConvictionTrendline } from "./ConvictionTrendline";
import { NarrativeStateBadge } from "./NarrativeStateBadge";
import { ResolutionHorizonBadge } from "./ResolutionHorizonBadge";
import { PressureMetersRow } from "./PressureMetersRow";
import { ReputationConflictBadge } from "./ReputationConflictBadge";
import { SocialSignalPills } from "./SocialSignalPills";
import { ForecastThesisLine } from "@/components/forecast/ForecastThesisLine";
import { getNarrativeStateStyle } from "./narrativeStateStyles";

const SENTIMENT_LABEL: Record<EnrichedMarket["sentiment"], string> = {
  bullish: "Bullish drift",
  bearish: "Bearish drift",
  split: "Sharp split",
  neutral: "Neutral watch",
};

const GLOW_CLASS: Record<EnrichedMarket["glow_intensity"], string> = {
  high: "markets-card-glow-high",
  medium: "markets-card-glow-med",
  low: "",
};

export function MarketFeedCardV2({
  market,
  index = 0,
}: {
  market: EnrichedMarket;
  index?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const resolved = isMarketResolved(market);
  const urgency = urgencyStyle[market.urgency] ?? urgencyStyle.cooling;
  const slug = market.slug;
  const stateStyle = getNarrativeStateStyle(market.narrative_state);
  const fragmented = stateStyle.fragmented;

  return (
    <article
      className={`group relative rounded-xl border bg-zinc-950/90 overflow-hidden feed-hover-lift ${GLOW_CLASS[market.glow_intensity]} ${
        market.in_network
          ? "border-zinc-700/80 ring-1 ring-zinc-700/40"
          : stateStyle.border
      } ${fragmented ? "markets-card-fragmented" : ""} ${market.is_hot ? "markets-card-hot" : ""} hover:border-zinc-700/80 cursor-pointer ${motionClass.cardEnterStagger(index)}`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onClick={() => setExpanded((e) => !e)}
    >
      {market.is_hot && (
        <div className="absolute inset-0 markets-card-pulse pointer-events-none" aria-hidden />
      )}
      <div
        className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-br ${stateStyle.tint} to-transparent pointer-events-none`}
      />

      <div className="relative p-3.5 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-2.5 mb-2 sm:mb-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="scry-meta px-1.5 py-0.5 rounded-md bg-zinc-900/60 border border-zinc-800/70">
              {market.category}
            </span>
            {market.resolution_horizon ? (
              <ResolutionHorizonBadge horizon={market.resolution_horizon} prominent />
            ) : null}
            {resolved ? (
              <span className="scry-badge scry-badge--emerald">
                Resolved {market.resolved_outcome ?? ""}
              </span>
            ) : (
              <>
                <span
                  className={`inline-flex items-center gap-0.5 text-[8px] font-medium uppercase px-1.5 py-0.5 rounded-full border capitalize ${urgency.ring} ${urgency.text}`}
                >
                  <span className={`h-1 w-1 rounded-full ${urgency.dot} feed-live-pill`} />
                  {market.urgency}
                </span>
                <NarrativeStateBadge state={market.narrative_state} pulse={market.is_hot} compact />
              </>
            )}
            {!resolved && <ReputationConflictBadge level={market.reputation_conflict} compact />}
            {market.in_network && (
              <HeatPill tone="violet" pulse>
                Network
              </HeatPill>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <MoveBadge delta={market.movement_delta} />
            <LiveDot color={market.is_hot ? "rose" : "violet"} />
          </div>
        </div>

        <SocialSignalPills signals={market.social_signals} />

        <Link
          href={`/markets/${slug}`}
          onClick={(e) => e.stopPropagation()}
          className="block mb-2 mt-2.5 cursor-pointer"
        >
          <h2 className="text-[15px] font-semibold scry-card-title leading-snug group-hover:text-zinc-100 transition-colors">
            {market.title}
          </h2>
          <ForecastThesisLine thesis={market.forecast_thesis} className="mt-1.5" />
        </Link>

        <p className="text-[12px] font-normal text-zinc-400 mb-1 leading-relaxed">
          {market.agent_lead_line}
        </p>
        {(market.stance_change_line || market.holdout_line) && (
          <p className="text-[9px] text-zinc-500 mb-1">
            {market.stance_change_line}
            {market.stance_change_line && market.holdout_line ? " · " : ""}
            {market.holdout_line}
          </p>
        )}

        <p className="text-[10px] font-medium text-violet-300/90 mb-1 leading-snug">
          {market.pressure_headline}
        </p>
        <p className="text-[10px] text-zinc-500 line-clamp-2 mb-2">{market.narrative}</p>

        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <MiniProbBar value={market.current_yes_probability} size="xs" hoverBoost />
          </div>
          <ConvictionTrendline seed={market.title} sentiment={market.sentiment} />
        </div>

        <div className="mb-1.5 sm:mb-2 rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-2 py-1.5">
          <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-1">Conviction pressure</p>
          <PressureMetersRow pressure={market.pressure} compact />
        </div>

        <div className="sm:hidden flex items-center gap-3 mb-1.5 text-[9px] text-zinc-500 tabular-nums">
          <span>
            <span className="text-zinc-600">Watch </span>
            {market.tracking_count}
          </span>
          <span>
            <span className="text-zinc-600">Battles </span>
            {market.battle_count}
          </span>
        </div>

        <div className="hidden sm:grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
          {[
            { label: "Watching", value: String(market.tracking_count) },
            { label: "Forecasters", value: String(market.active_forecasters) },
            { label: "Battles", value: String(market.battle_count) },
            { label: "Intensity", value: `${market.narrative_intensity}` },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-md bg-zinc-900/70 border border-zinc-800/70 px-1.5 py-1"
            >
              <p className="text-[7px] uppercase tracking-wider text-zinc-600">{s.label}</p>
              <p className="text-[9px] font-semibold text-zinc-300 truncate">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="hidden sm:block rounded-lg border border-zinc-800/70 bg-zinc-900/50 px-2 py-1.5 mb-2 space-y-1">
          <p className="text-[9px] text-zinc-600">
            Lore · <span className="text-zinc-400">{market.market_memory[0]?.text ?? market.why_moved}</span>
          </p>
          <p className="text-[9px] text-zinc-600">
            Narrative · <span className="text-zinc-400">{market.narrative_cluster}</span>
          </p>
          <p className="text-[10px] text-zinc-400 line-clamp-1">
            <span className="text-emerald-400/80">Top take ·</span> {market.top_take}
          </p>
          {market.network_lean && (
            <p className="text-[9px] text-violet-400/90">{market.network_lean}</p>
          )}
        </div>

        <AgreementMeter
          agree={market.reputation_yes_share}
          disagree={market.disagreement_pct}
          label="Reputation on YES"
          compact
        />

        <div className="flex flex-wrap gap-1 mt-2">
          {market.leading_agents.slice(0, 3).map((a) => (
            <Link
              key={a.slug}
              href={`/agents/${a.slug}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[8px] px-1.5 py-0.5 rounded-md border border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-violet-300 hover:border-violet-500/30"
            >
              {a.name} · {a.side}
            </Link>
          ))}
        </div>

        <div
          className={`feed-intel-reveal mt-2 pt-2 border-t border-zinc-800/60 ${expanded ? "is-visible is-tapped" : ""}`}
        >
          <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
            Market memory
          </p>
          <ul className="space-y-1 text-[10px] text-zinc-500 mb-2">
            {market.market_memory.map((mem) => (
              <li key={mem.id}>
                <span className="text-zinc-600">◆ </span>
                {mem.text}
              </li>
            ))}
          </ul>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-zinc-600 mb-1">
            Intelligence preview
          </p>
          <ul className="space-y-1 text-[10px] text-zinc-500">
            <li>
              <span className="text-zinc-600">Why it moved ·</span> {market.why_moved}
            </li>
            <li>
              <span className="text-zinc-600">Sentiment ·</span> {SENTIMENT_LABEL[market.sentiment]}
            </li>
            <li>
              <span className="text-zinc-600">Strongest disagreement ·</span>{" "}
              {market.disagree_agent} fading consensus
            </li>
            <li>
              <span className="text-zinc-600">Copied position ·</span> {market.copied_position}
            </li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-zinc-800/60">
          <Link
            href={`/markets/${slug}`}
            onClick={(e) => e.stopPropagation()}
            className="feed-chip-active text-[11px] px-2.5 py-1 rounded-md border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800/90"
          >
            Command center
          </Link>
          <Link
            href={`/markets/${slug}#take-position`}
            onClick={(e) => e.stopPropagation()}
            className="feed-chip-active text-[11px] px-2.5 py-1 rounded-md font-medium bg-white text-zinc-950 border-transparent hover:bg-zinc-200"
          >
            Take position
          </Link>
        </div>
      </div>
    </article>
  );
}
