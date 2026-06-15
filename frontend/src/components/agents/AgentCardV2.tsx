"use client";

import Link from "next/link";
import { Avatar } from "@/components/feed/shared";
import { motionClass } from "@/components/feed/motion";
import { AgentFollowButton } from "./AgentFollowButton";
import { CredibilityOnboardingDisplay } from "@/components/reputation/CredibilityOnboardingDisplay";
import { buildCredibilityFromAgent } from "@/lib/credibilityScore";
import type { AgentHeatState, EnrichedAgent } from "./types";

const PERSONALITY_STYLES: Record<
  EnrichedAgent["personality"],
  { border: string; glow: string; accent: string; badge: string; tagline: string }
> = {
  contrarian: {
    border: "hover:border-rose-500/35",
    glow: "shadow-rose-950/25",
    accent: "from-rose-950/40",
    badge: "border-rose-500/25 bg-rose-950/40 text-rose-200/90",
    tagline: "text-rose-100/95",
  },
  macro: {
    border: "hover:border-sky-500/30",
    glow: "shadow-sky-950/20",
    accent: "from-sky-950/35",
    badge: "border-sky-500/25 bg-sky-950/40 text-sky-200/90",
    tagline: "text-sky-100/95",
  },
  chaos: {
    border: "hover:border-amber-500/40",
    glow: "shadow-amber-950/30",
    accent: "from-amber-950/40",
    badge: "border-amber-500/25 bg-amber-950/40 text-amber-200/90",
    tagline: "text-amber-50/95",
  },
  analyst: {
    border: "hover:border-violet-500/35",
    glow: "shadow-violet-950/25",
    accent: "from-violet-950/40",
    badge: "border-violet-500/25 bg-violet-950/40 text-violet-200/90",
    tagline: "text-violet-100/95",
  },
  hunter: {
    border: "hover:border-emerald-500/30",
    glow: "shadow-emerald-950/20",
    accent: "from-emerald-950/35",
    badge: "border-emerald-500/25 bg-emerald-950/40 text-emerald-200/90",
    tagline: "text-emerald-100/95",
  },
  default: {
    border: "hover:border-zinc-600/80",
    glow: "shadow-black/40",
    accent: "from-violet-950/30",
    badge: "border-zinc-700/60 bg-zinc-900/60 text-zinc-300",
    tagline: "text-zinc-100",
  },
};

const MOMENTUM_CLASS: Record<AgentHeatState, string> = {
  hot: "text-rose-300/90",
  rising: "text-emerald-300/90",
  cooling: "text-zinc-500",
  cult_forming: "text-violet-300/90",
  crowded: "text-amber-300/85",
  undervalued: "text-sky-300/90",
  consensus_enemy: "text-rose-200/85",
  breakout: "text-emerald-200/95",
  dormant: "text-zinc-500",
};

function formatMomentumCaption(agent: EnrichedAgent): string {
  if (agent.heat_state === "hot") return "Hot right now";
  if (
    agent.rank_delta != null &&
    agent.rank_delta > 0 &&
    (agent.heat_state === "rising" ||
      agent.heat_state === "breakout" ||
      agent.trend === "up")
  ) {
    const base = agent.heat_label === "Breakout" ? "Breakout" : "Rising";
    return `${base} +${agent.rank_delta}`;
  }
  return agent.heat_label;
}

const HOT_STATES = new Set(["hot", "breakout", "cult_forming"]);

function RecordStat({
  label,
  value,
  accent = "text-zinc-200",
  caption,
  captionAccent = "text-zinc-600",
}: {
  label: string;
  value: string;
  accent?: string;
  caption?: string | null;
  captionAccent?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2 py-1.5">
      <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-zinc-600 leading-none">
        {label}
      </p>
      <p className={`text-[14px] font-bold tabular-nums leading-tight mt-1 ${accent}`}>
        {value}
        {caption && (
          <span className={`ml-1 text-[10px] font-semibold ${captionAccent}`}>{caption}</span>
        )}
      </p>
    </div>
  );
}

export function AgentCardV2({
  agent,
  following,
  onToggleFollow,
  staggerIndex = 0,
  followDisabled = false,
  rank,
}: {
  agent: EnrichedAgent;
  following: boolean;
  onToggleFollow: () => void;
  staggerIndex?: number;
  followDisabled?: boolean;
  /** League rank by reputation — shown as the card's status anchor. */
  rank?: number;
}) {
  const style = PERSONALITY_STYLES[agent.personality];
  const isHot = HOT_STATES.has(agent.heat_state);
  const credibility = buildCredibilityFromAgent(agent);
  const repDelta = agent.reputation_delta ?? 0;
  const rankDelta = agent.rank_delta ?? 0;

  return (
    <article
      className={`group relative flex flex-col rounded-xl border border-zinc-800/85 bg-zinc-950/90 overflow-hidden feed-hover-lift feed-card-glow cursor-pointer ${style.border} ${motionClass.cardEnterStagger(staggerIndex)} ${isHot ? "agent-card-hot" : ""}`}
      style={{
        boxShadow: isHot
          ? `0 0 ${14 + agent.momentum_glow * 28}px rgba(139, 92, 246, ${0.08 + agent.momentum_glow * 0.1})`
          : agent.trend === "up"
            ? `0 0 ${8 + agent.momentum_glow * 16}px rgba(139, 92, 246, ${0.04 + agent.momentum_glow * 0.06})`
            : undefined,
      }}
    >
      <Link
        href={`/agents/${agent.slug}`}
        className="absolute inset-0 z-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
        aria-label={`View ${agent.name} profile`}
      />

      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${style.accent} to-transparent`}
      />

      <div className="relative z-[1] p-3.5 pointer-events-none flex flex-col flex-1 min-h-0">
        <div className="flex items-start gap-3">
          <Avatar name={agent.name} color={agent.avatar_color} size="lg" />
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-[15px] font-semibold text-white truncate group-hover:text-violet-50 transition-colors leading-tight tracking-tight">
                {agent.name}
              </h2>
              {rank != null && (
                <span className="shrink-0 inline-flex items-baseline gap-1 rounded-md border border-zinc-700/70 bg-zinc-900/80 px-1.5 py-0.5">
                  <span className="text-[12px] font-bold tabular-nums text-zinc-100">
                    #{rank}
                  </span>
                  {rankDelta !== 0 && (
                    <span
                      className={`text-[10px] font-bold tabular-nums ${
                        rankDelta > 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {rankDelta > 0 ? `▲${rankDelta}` : `▼${Math.abs(rankDelta)}`}
                    </span>
                  )}
                </span>
              )}
            </div>
            <p
              className={`text-[13px] font-medium leading-snug mt-1 line-clamp-2 ${style.tagline}`}
            >
              {agent.personality_quote}
            </p>

            <span
              className={`inline-block mt-2 text-[9px] font-medium px-1.5 py-px rounded-full border ${style.badge} opacity-80`}
            >
              {agent.niche_badge}
            </span>
          </div>
        </div>

        {credibility.onboarding ? (
          <div className="mt-3">
            <CredibilityOnboardingDisplay onboarding={credibility.onboarding} variant="inline" />
          </div>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              <RecordStat
                label="Reputation"
                value={String(Math.round(agent.reputation_score))}
                accent="text-zinc-100"
                caption={
                  repDelta !== 0
                    ? `${repDelta > 0 ? "+" : "−"}${Math.abs(Math.round(repDelta))}`
                    : null
                }
                captionAccent={repDelta >= 0 ? "text-emerald-400" : "text-rose-400"}
              />
              <RecordStat
                label="Streak"
                value={agent.streak > 0 ? `W${agent.streak}` : "—"}
                accent={agent.streak >= 4 ? "text-amber-300" : "text-zinc-200"}
                caption={agent.streak >= 4 ? "🔥" : null}
              />
              <RecordStat
                label="Receipts"
                value={String(agent.receipts_count)}
                accent="text-emerald-300/90"
              />
            </div>
            <p
              className={`text-[11px] font-medium leading-snug mt-2 ${MOMENTUM_CLASS[agent.heat_state]}`}
            >
              {formatMomentumCaption(agent)}
            </p>
          </>
        )}
      </div>

      <div className="relative z-[2] flex items-center justify-between gap-2 px-3.5 py-2.5 border-t border-zinc-800/70 bg-zinc-950/95 mt-auto">
        {agent.primary_rival_slug && agent.primary_rival_name ? (
          <Link
            href={`/compare/${agent.slug}/${agent.primary_rival_slug}`}
            className="text-[10px] font-medium text-rose-300/85 hover:text-rose-200 min-w-0 truncate transition-colors"
            title={`Head-to-head: ${agent.name} vs ${agent.primary_rival_name}`}
          >
            ⚔ {agent.rival_record ?? `vs ${agent.primary_rival_name}`}
          </Link>
        ) : (
          <p className="text-[9px] text-zinc-500 pointer-events-none min-w-0 truncate italic">
            @{agent.slug}
          </p>
        )}
        <AgentFollowButton
          following={following}
          onToggle={onToggleFollow}
          followHover={agent.follow_hover}
          whyFollow={agent.why_follow}
          feedLens={agent.feed_lens}
          disabled={followDisabled}
        />
      </div>
    </article>
  );
}

/** Compact strip card for horizontal scroll */
export function AgentStripCard({ agent }: { agent: EnrichedAgent }) {
  const style = PERSONALITY_STYLES[agent.personality];
  const isHot = HOT_STATES.has(agent.heat_state);
  const credibility = buildCredibilityFromAgent(agent);

  return (
    <Link
      href={`/agents/${agent.slug}`}
      className={`relative feed-hover-lift cursor-pointer shrink-0 w-[188px] sm:w-[204px] flex flex-col gap-1.5 p-2.5 rounded-xl border border-zinc-800/80 bg-zinc-950/90 overflow-hidden ${style.border} ${isHot ? "agent-card-hot" : ""}`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-16 rounded-t-xl bg-gradient-to-b ${style.accent} to-transparent pointer-events-none`}
      />
      <div className="relative flex items-start gap-2">
        <Avatar name={agent.name} color={agent.avatar_color} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-white truncate leading-tight">{agent.name}</p>
          <p className={`text-[12px] font-medium leading-snug mt-1 line-clamp-2 ${style.tagline}`}>
            {agent.personality_quote}
          </p>
          {!credibility.onboarding && (
            <div className="mt-1.5 space-y-px">
              <p className="text-[9px] text-zinc-500 leading-none">
                <span className="tabular-nums text-zinc-400">{credibility.score}</span> credibility
              </p>
              <p
                className={`text-[9px] font-medium leading-snug ${MOMENTUM_CLASS[agent.heat_state]}`}
              >
                {formatMomentumCaption(agent)}
              </p>
            </div>
          )}
        </div>
      </div>
      <p className="relative text-[9px] text-zinc-600 line-clamp-2 leading-snug">
        {agent.recent_take}
      </p>
    </Link>
  );
}
