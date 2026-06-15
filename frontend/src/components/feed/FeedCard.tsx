"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useRouter } from "next/navigation";
import { useRelativeTimeTick } from "@/hooks/useRelativeTimeTick";
import type { FeedEvent } from "./feedMix";
import { CredibilityMiniBar } from "./CredibilityMiniBar";
import { ReputationScore } from "@/components/reputation/ReputationScore";
import { buildCredibilityFromFeedEvent } from "@/lib/credibilityScore";
import { getRankContext } from "@/lib/rankContext";
import { RankCompactBadge, RankDeltaPill } from "@/components/reputation/RankContextDisplay";
import { FeaturedReputationMarks } from "@/components/milestones/FeaturedReputationMarks";
import { MilestoneBadge } from "@/components/milestones/MilestoneBadge";
import { milestoneStyle } from "@/components/milestones/milestoneStyles";
import { ReputationTierBadge } from "@/components/reputation/ReputationTierBadge";
import { TrustTierBadge } from "@/components/trust/TrustTierBadge";
import { resolveCharacterMoment } from "./feedCharacterMoments";
import { collectOpenLoopChips, deriveResolutionOpenLoop } from "./feedOpenLoops";
import { resolveCardIdentity, streamPulseClass, tintToCssVars } from "./feedCardIdentity";
import { motionClass } from "./motion";
import { feedDisplayTimestamp, feedSecondaryTimingLabel } from "@/lib/feedTiming";
import {
  Avatar,
  LiveDot,
  MiniProbBar,
  MoveBadge,
  formatTimeAgo,
} from "./shared";
import { FeedInteractionModal } from "./FeedInteractionModals";
import {
  FeedInteractionHighlights,
  FeedInteractionStats,
} from "./FeedInteractionHighlights";
import type { FeedInteractionRecord, FeedInteractionSummary } from "@/lib/feedInteractions";
import { ForecastThesisLine } from "@/components/forecast/ForecastThesisLine";
import { receiptHrefFromFeedEventId } from "@/lib/receipts";
import { mergeInteractionAfterSubmit } from "./feedInteractionState";
import { actionStateLabel, resolveFeedActionLabel, resolveFeedActionState } from "@/lib/feedActionStates";

const TYPE_LABELS: Record<string, string> = {
  confidence_shift: "Shift",
  rivalry: "Rivalry",
  receipt: "Verified",
  consensus_shift: "Narrative",
  leaderboard_move: "Rep jump",
  battle_escalation: "Rivalry",
  verified_call: "Verified",
  market_move: "Move",
  reputation_move: "Rep",
  milestone_unlock: "Milestone",
  calibration_jump: "Calibration",
  failed_high_conviction_call: "Miss",
  season_shift: "Era shift",
  season_lead: "Season lead",
  season_arc: "Narrative arc",
  stance_followup: "Follow-up",
  quiet_pulse: "Pulse",
  new_take: "Take",
  signal_shift: "Signal",
  position_update: "Conviction",
  season_collapse: "Collapse",
};

const cardBadge: Record<string, string> = {
  confidence_shift: "text-violet-300/90 bg-violet-500/8 border-violet-500/15",
  rivalry: "text-rose-300/90 bg-rose-500/8 border-rose-500/15",
  receipt: "text-emerald-300/90 bg-emerald-500/8 border-emerald-500/15",
  consensus_shift: "text-sky-300/90 bg-sky-500/8 border-sky-500/15",
  leaderboard_move: "text-amber-300/90 bg-amber-500/8 border-amber-500/15",
  milestone_unlock:
    "text-amber-200/95 bg-gradient-to-r from-amber-500/10 to-zinc-800/40 border-amber-500/25",
  calibration_jump: "text-cyan-300/90 bg-cyan-500/8 border-cyan-500/15",
  failed_high_conviction_call: "text-rose-300/90 bg-rose-500/10 border-rose-500/20",
  season_shift: "text-amber-200/95 bg-amber-950/40 border-amber-500/25",
  season_lead: "text-amber-200/95 bg-amber-950/35 border-amber-500/22",
  season_arc: "text-amber-200/90 bg-amber-950/45 border-amber-500/20",
  season_collapse: "text-rose-200/90 bg-rose-950/30 border-rose-500/20",
};

const SEASON_EVENT_TYPES = new Set([
  "season_shift",
  "season_lead",
  "season_arc",
  "season_collapse",
]);

const MAX_CHIPS = 2;

type ChipDef = {
  id: string;
  label: string;
  className: string;
  priority: number;
};

type CardDensity = "hero" | "standard" | "compact";

function baselineFromEvent(event: FeedEvent): number | null {
  if (event.probability == null) return null;
  const delta = event.movement_delta ?? 0;
  return Math.max(5, Math.min(95, Math.round(event.probability - delta)));
}

function resolveDensity(event: FeedEvent, index: number): CardDensity {
  if (event.importance_tier === "major" || event.interruptive_event) return "hero";
  if (event.importance_tier === "ambient") return "compact";
  if (SEASON_EVENT_TYPES.has(event.type)) return "hero";
  if (event.type === "milestone_unlock") return "hero";
  if (event.type === "receipt" || event.has_verified_proof || event.type === "verified_call") {
    return "hero";
  }
  if (event.type === "rivalry" || event.type === "battle_escalation") return "compact";
  if (event.type === "leaderboard_move" || (event.confidence ?? 0) >= 88) return "hero";
  if (event.type === "consensus_shift" || event.type === "confidence_shift") {
    return index % 2 === 1 ? "compact" : "standard";
  }
  return index % 3 === 0 ? "hero" : "standard";
}

function collectChips(
  event: FeedEvent,
  typeLabel: string,
  typeBadge: string,
  interactions?: FeedInteractionSummary,
): {
  visible: ChipDef[];
  overflow: number;
  meta: string[];
} {
  const chips: ChipDef[] = [];

  if (event.horizon_label) {
    chips.push({
      id: "horizon",
      label: event.horizon_label,
      className:
        event.resolution_horizon_bucket === "tonight" || event.resolution_horizon_bucket === "soon"
          ? "text-amber-200/95 bg-amber-500/12 border-amber-500/30"
          : "text-zinc-300/80 bg-zinc-500/8 border-zinc-500/20",
      priority: event.resolution_open_loop ? 1 : 3,
    });
  }
  if (event.continuity_label) {
    chips.push({
      id: "continuity",
      label: event.continuity_label,
      className: "text-violet-200/90 bg-violet-500/10 border-violet-500/25 capitalize",
      priority: 0,
    });
  }
  if (event.arc_progression) {
    chips.push({
      id: "arc",
      label: event.arc_progression,
      className: "text-amber-200/85 bg-amber-950/40 border-amber-500/20 capitalize",
      priority: 1,
    });
  }
  if (event.market_narrative_state || event.action_state_label) {
    chips.push({
      id: "market-state",
      label: event.action_state_label ?? resolveFeedActionLabel(event),
      className: "text-sky-200/80 bg-sky-500/8 border-sky-500/15",
      priority: 4,
    });
  }
  if (event.live_mutation) {
    chips.push({
      id: "mutation",
      label: event.live_mutation,
      className: "text-cyan-200/85 bg-cyan-500/8 border-cyan-500/20 capitalize",
      priority: 2,
    });
  }
  if (event.interruptive_event) {
    chips.push({
      id: "interrupt",
      label: event.interruptive_event,
      className: "text-rose-200/90 bg-rose-500/12 border-rose-500/25 capitalize",
      priority: 0,
    });
  }
  if (event.type === "milestone_unlock" && event.milestone) {
    chips.push({
      id: "milestone",
      label: event.milestone.title,
      className: "text-amber-200/90 bg-amber-500/8 border-amber-500/25",
      priority: 0,
    });
  }
  if (event.live) {
    chips.push({
      id: "live",
      label: actionStateLabel("watch_live") ?? "Watch Live",
      className: "text-rose-300/90 bg-rose-500/10 border-rose-500/20",
      priority: 0,
    });
  }
  if (event.has_verified_proof || event.type === "receipt" || event.type === "verified_call") {
    chips.push({
      id: "verified",
      label: "Verified",
      className: "text-emerald-300/90 bg-emerald-500/10 border-emerald-500/20",
      priority: 1,
    });
  }
  if (event.type === "rivalry" || event.type === "battle_escalation" || (event.disagreement_spread ?? 0) >= 22) {
    const battleLabel =
      resolveFeedActionState(event) === "verdict_pending"
        ? actionStateLabel("verdict_pending")
        : actionStateLabel("rivalry_active");
    chips.push({
      id: "battle",
      label: battleLabel ?? "Rivalry Active",
      className: "text-rose-300/90 bg-rose-500/10 border-rose-500/20",
      priority: 2,
    });
  }
  if (event.reputation_delta != null && event.reputation_delta !== 0) {
    chips.push({
      id: "rep",
      label: `+${event.reputation_delta} rep`,
      className: "text-amber-300/90 bg-amber-500/10 border-amber-500/20",
      priority: 3,
    });
  }
  for (const label of event.memory_labels || []) {
    chips.push({
      id: `memory-${label}`,
      label,
      className: "text-indigo-200/90 bg-indigo-500/10 border-indigo-500/20",
      priority: 2,
    });
  }

  for (const loop of collectOpenLoopChips(event, interactions)) {
    if (!chips.some((c) => c.id === loop.id)) {
      chips.push(loop);
    }
  }

  chips.push({
    id: "type",
    label: typeLabel,
    className: typeBadge,
    priority: 8,
  });

  if (event.movement_delta != null && event.movement_delta !== 0) {
    chips.push({
      id: "move",
      label: `${event.movement_delta > 0 ? "+" : ""}${event.movement_delta}pt`,
      className: "text-violet-300/80 bg-violet-500/8 border-violet-500/15",
      priority: 6,
    });
  }

  chips.sort((a, b) => a.priority - b.priority);
  const visible = chips.slice(0, MAX_CHIPS);
  const visibleIds = new Set(visible.map((c) => c.id));
  const overflow = Math.max(0, chips.length - MAX_CHIPS);

  const meta: string[] = [];
  if (event.active_takes != null && !visibleIds.has("takes")) {
    meta.push(`${event.active_takes} takes`);
  }
  if (event.credibility_label && !visibleIds.has("cred")) {
    meta.push(event.credibility_label);
  }
  if (event.disagreement_spread != null && !visibleIds.has("battle")) {
    meta.push(`${event.disagreement_spread}pt split`);
  }
  if (reasoningMeta(event) && !visibleIds.has("narrative")) {
    meta.push(reasoningMeta(event)!);
  }

  return { visible, overflow, meta };
}

function reasoningMeta(event: FeedEvent): string | null {
  const d = event.reasoning?.narrative_driver;
  if (!d) return null;
  return d.length > 36 ? `${d.slice(0, 34)}…` : d;
}

function IntelRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-1.5 min-w-0 text-[10px] leading-snug">
      <span className="scry-text-tertiary shrink-0 w-3 text-center" aria-hidden>
        {icon}
      </span>
      <span className="scry-text-tertiary shrink-0">{label}</span>
      <span className="scry-text-secondary min-w-0 truncate">{value}</span>
    </div>
  );
}

const densityStyles: Record<CardDensity, { pad: string; gap: string; title: string; body: string }> = {
  hero: { pad: "p-4 sm:p-4 lg:p-5", gap: "gap-3 sm:gap-3.5", title: "text-[15px] sm:text-base lg:text-[17px]", body: "text-[12px] sm:text-[13px] line-clamp-3" },
  standard: { pad: "p-3.5 sm:p-4", gap: "gap-2.5 sm:gap-3", title: "text-[14px] sm:text-[15px]", body: "text-[12px] line-clamp-2" },
  compact: { pad: "p-3", gap: "gap-2 sm:gap-2.5", title: "text-[13px]", body: "text-[11px] sm:text-[12px] line-clamp-1" },
};

export function FeedCard({
  event,
  index = 0,
  className,
}: {
  event: FeedEvent;
  index?: number;
  className?: string;
}) {
  useRelativeTimeTick();
  const { user } = useAuth();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [interactionSummary, setInteractionSummary] = useState<
    FeedInteractionSummary | undefined
  >(event.interactions);
  const [backOpen, setBackOpen] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);

  const summary = interactionSummary ?? event.interactions;
  const userRead = summary?.user_interaction;

  const requireAuth = useCallback(() => {
    if (!user) {
      router.push("/login");
      return false;
    }
    return true;
  }, [user, router]);

  useEffect(() => {
    setInteractionSummary(event.interactions);
  }, [event.interactions, event.id]);

  const onInteractionSuccess = useCallback((record: FeedInteractionRecord) => {
    setInteractionSummary((prev) => mergeInteractionAfterSubmit(prev ?? event.interactions, record));
  }, [event.interactions]);
  const publishedAt = feedDisplayTimestamp(event);
  const secondaryTiming = feedSecondaryTimingLabel(event);

  const density = resolveDensity(event, index);
  const d = densityStyles[density];
  const identity = resolveCardIdentity(event);
  const streamBoost =
    Boolean(event.show_new) ||
    Boolean(
      event.is_streamed &&
        event.streamed_at &&
        Date.now() - event.streamed_at < 15_000,
    );
  const identityStyle = tintToCssVars(identity.tint, streamBoost);
  const badge = cardBadge[event.type] ?? "text-zinc-400 bg-zinc-800/60 border-zinc-700/80";
  const typeLabel = TYPE_LABELS[event.type] ?? event.type.replace(/_/g, " ");
  const following = event.following_agent === true;
  const isAnchor = event.anchor_agent === true;
  const marketHref = event.market_slug ? `/markets/${event.market_slug}` : null;
  const verifiedHref =
    event.type === "receipt" && event.id != null
      ? receiptHrefFromFeedEventId(event.id)
      : event.type === "receipt"
        ? marketHref ?? "/verified-calls"
        : null;
  const battleHref = event.type === "rivalry" || event.type === "battle_escalation" ? "/battles" : null;
  const seasonHref =
    event.season_slug != null
      ? `/season?slug=${event.season_slug}`
      : event.type.startsWith("season_")
        ? "/season"
        : null;
  const reasoning = event.reasoning;
  const baseline = baselineFromEvent(event);
  const tierKey = event.reputation_tier_key ?? event.agent.tier_key ?? "emerging";
  const tierLabel = event.reputation_tier_label ?? event.agent.tier_label ?? "Emerging";
  const trustTierKey = event.trust_tier_key;
  const trustTierLabel = event.trust_tier_label;
  const agentCredibility = buildCredibilityFromFeedEvent(event);
  const feedRank = getRankContext({
    slug: event.agent.slug,
    credibilityScore: agentCredibility.score,
    reputationDelta: event.reputation_delta,
    niche: event.agent.niche,
  });
  const { visible: chips, overflow, meta } = collectChips(event, typeLabel, badge, summary);
  const characterMoment = resolveCharacterMoment(event);
  const resolutionLoop = deriveResolutionOpenLoop(event);
  const avatarSize = density === "compact" ? "sm" : density === "hero" ? "lg" : "md";

  const isStreamActive = event.show_new || event.is_streamed;
  const pulseClass = streamPulseClass(event);
  const isMilestone = event.type === "milestone_unlock";
  const isSeasonMemory = SEASON_EVENT_TYPES.has(event.type);
  const ms = event.milestone;
  const msStyle = ms ? milestoneStyle(ms.category) : null;
  const consensusSplit =
    event.credibility_split != null
      ? `${Math.round((100 * event.credibility_split.yes.total_reputation) / (event.credibility_split.yes.total_reputation + event.credibility_split.no.total_reputation || 1))}% YES lean`
      : event.reputation_yes_share != null
        ? `${Math.round(event.reputation_yes_share * 100)}% rep YES`
        : null;

  return (
    <article
      onClick={() => setExpanded((t) => !t)}
      style={identityStyle}
      data-agent={identity.label}
      data-archetype={identity.archetype}
      className={[
        "group relative flex flex-col border border-white/5 rounded-xl feed-card-premium feed-card-identity feed-hover-lift backdrop-blur-sm outline-none",
        identity.eventClass,
        `feed-card-archetype-${identity.archetype}`,
        d.pad,
        d.gap,
        motionClass.cardEnterStagger(index),
        className ?? "",
        following || isAnchor ? "ring-1 ring-violet-500/15" : "",
        isAnchor ? "ring-violet-400/25" : "",
        isStreamActive ? "feed-card-stream-active" : "",
        pulseClass,
        density === "compact" ? "feed-card-compact" : density === "hero" ? "feed-card-hero" : "",
        isMilestone ? "border-amber-500/20 bg-gradient-to-br from-zinc-950 via-zinc-950/95 to-amber-950/20" : "",
        isMilestone && msStyle ? msStyle.glow : "",
        isSeasonMemory ? "feed-season-memory border-amber-500/18 bg-gradient-to-br from-amber-950/12 via-zinc-950/95 to-zinc-950" : "",
      ].join(" ")}
    >
      {isSeasonMemory && (
        <div className="flex items-center gap-2 mb-1 -mt-0.5 pb-2 border-b border-amber-500/10">
          <span className="h-px flex-1 bg-gradient-to-r from-amber-500/25 to-transparent" aria-hidden />
          <span className="text-[8px] font-semibold uppercase tracking-[0.2em] text-amber-500/70 shrink-0">
            Historical event
          </span>
          <span className="h-px flex-1 bg-gradient-to-l from-amber-500/25 to-transparent" aria-hidden />
        </div>
      )}
      {/* Agent header — character-forward */}
      <div className="feed-agent-header flex items-start gap-2.5 min-w-0">
        <Link
          href={`/agents/${event.agent.slug}`}
          onClick={(e) => e.stopPropagation()}
          className="feed-agent-identity flex items-center gap-2.5 min-w-0 flex-1 rounded-lg -m-0.5 p-0.5 hover:bg-zinc-900/40 transition"
        >
          <div
            className="feed-agent-avatar-ring shrink-0 rounded-full"
            style={{
              boxShadow: `0 0 0 1px rgb(${identity.tint.join(" ")} / 0.35), 0 0 14px rgb(${identity.tint.join(" ")} / 0.12)`,
            }}
          >
            <Avatar name={event.agent.name} color={event.agent.avatar_color} size={avatarSize} />
          </div>
          <div className="min-w-0 flex-1 border-l border-zinc-800/50 pl-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="feed-agent-name text-[14px] sm:text-[15px] font-semibold scry-text-primary truncate tracking-tight">
                {event.agent.name}
              </p>
              {trustTierKey && trustTierLabel ? (
                <TrustTierBadge tierKey={trustTierKey} tierLabel={trustTierLabel} compact />
              ) : (
                <ReputationTierBadge tierKey={tierKey} tierLabel={tierLabel} compact />
              )}
              <RankCompactBadge rank={feedRank} />
              {(event.type === "leaderboard_move" || event.type === "reputation_move") && (
                <RankDeltaPill rankDelta={feedRank.rankDelta} isNew={feedRank.isNew} />
              )}
              {event.featured_reputation_marks && event.featured_reputation_marks.length > 0 && (
                <FeaturedReputationMarks marks={event.featured_reputation_marks} limit={2} />
              )}
              {event.live && density !== "compact" && <LiveDot />}
              {isAnchor && (
                <span className="text-[8px] font-medium text-cyan-200/90 bg-cyan-500/12 border border-cyan-500/25 px-1 py-px rounded">
                  Your anchor agent
                </span>
              )}
              {following && !isAnchor && (
                <span className="text-[8px] font-medium text-violet-300/80 bg-violet-500/12 border border-violet-500/25 px-1 py-px rounded">
                  Following
                </span>
              )}
            </div>
            <p className="text-[10px] scry-text-tertiary truncate mt-0.5">
              @{event.agent.slug}
              {event.agent.niche ? ` · ${event.agent.niche}` : ""}
            </p>
            {characterMoment && density !== "compact" && (
              <p
                className={`feed-agent-voice text-[10px] leading-snug mt-1 line-clamp-1 ${
                  characterMoment.kind === "phrase"
                    ? "text-zinc-400/90 italic"
                    : characterMoment.kind === "rivalry"
                      ? "text-rose-300/75"
                      : characterMoment.kind === "confidence"
                        ? "text-violet-300/70"
                        : "text-zinc-500"
                }`}
              >
                {characterMoment.kind === "label" && (
                  <span className="not-italic text-zinc-600 mr-1">·</span>
                )}
                {characterMoment.text}
              </p>
            )}
          </div>
        </Link>

        <div className="text-right shrink-0 flex flex-col items-end gap-1 max-w-[38%] sm:max-w-none">
          <ReputationScore data={agentCredibility} variant="compact" />
          {event.show_new && (
            <span className="text-[8px] font-semibold text-emerald-300 bg-emerald-500/12 border border-emerald-500/25 px-1 py-px rounded">
              NEW
            </span>
          )}
          <span className="text-[9px] scry-text-tertiary tabular-nums">
            {event.show_new ? "now" : formatTimeAgo(publishedAt, true)}
          </span>
          {!event.show_new && secondaryTiming && (
            <span className="text-[8px] scry-text-tertiary/80 tabular-nums leading-tight max-w-[9rem] text-right line-clamp-2">
              {secondaryTiming}
            </span>
          )}
        </div>
      </div>

      {resolutionLoop ? (
        <p className="feed-open-loop-banner text-[10px] sm:text-[11px] font-medium text-amber-200/95 -mt-0.5 px-2 py-1 rounded-md bg-amber-500/8 border border-amber-500/20 w-fit max-w-full">
          {resolutionLoop}
        </p>
      ) : null}

      {/* Chips — max 3 visible; overflow + meta as soft tertiary */}
      <div className="flex flex-wrap items-center gap-1 min-w-0">
        {chips.map((c) => (
          <span
            key={c.id}
            className={`inline-flex text-[9px] font-medium px-1.5 py-0.5 rounded border ${c.className}`}
          >
            {c.label}
          </span>
        ))}
        {overflow > 0 && (
          <span className="text-[9px] scry-text-tertiary px-1 py-0.5">+{overflow}</span>
        )}
        {meta.length > 0 && (
          <span className="text-[9px] scry-text-tertiary truncate w-full sm:w-auto sm:ml-auto">
            {meta.join(" · ")}
          </span>
        )}
      </div>

      {/* Primary — title, thesis, conviction */}
      <div className="space-y-2 min-w-0">
        {event.personalization_reason && (
          <p className="text-[9px] text-violet-400/60 line-clamp-1">{event.personalization_reason}</p>
        )}

        <h2 className={`${d.title} font-semibold scry-text-primary leading-snug tracking-tight`}>
          {event.title}
        </h2>

        {event.forecast_thesis && (
          <ForecastThesisLine
            thesis={event.forecast_thesis}
            compact={density === "compact"}
            className="-mt-0.5"
          />
        )}

        {isMilestone && ms && (
          <div className="flex items-center gap-2 pt-1">
            <MilestoneBadge title={ms.title} category={ms.category} />
            <span className="text-[9px] scry-text-tertiary">Prestige unlock</span>
          </div>
        )}

        {expanded &&
          (reasoning?.summary ? (
            <p className={`${d.body} scry-text-secondary leading-relaxed`}>{reasoning.summary}</p>
          ) : (
            !event.forecast_thesis && (
              <p className={`${d.body} scry-text-secondary/80 leading-relaxed`}>{event.body}</p>
            )
          ))}

        {event.primary_memory_callback && (
          <p className="text-[10px] scry-text-tertiary leading-snug border-l-2 border-indigo-500/20 pl-2.5">
            <span className="block">{event.primary_memory_callback}</span>
          </p>
        )}

        {(event.prior_thesis || event.rivalry_memory || event.rivalry_callback?.line) && (
          <p className="text-[10px] scry-text-tertiary leading-snug border-l-2 border-violet-500/20 pl-2.5">
            {(event.rivalry_memory || event.rivalry_callback?.line) && (
              <span className="block">{event.rivalry_memory || event.rivalry_callback?.line}</span>
            )}
            {event.prior_thesis && !event.rivalry_memory && !event.rivalry_callback?.line && (
              <span className="block">
                <span className="scry-text-tertiary">Prior read · </span>
                {event.prior_thesis}
              </span>
            )}
          </p>
        )}

        {event.probability != null && (
          <div className="flex items-center gap-3 min-w-0 pt-1">
            <div className="flex items-baseline gap-1 shrink-0">
              <span className="text-xl sm:text-2xl font-semibold scry-text-primary tabular-nums tracking-tight">
                {Math.round(event.probability)}
              </span>
              <span
                className="text-[11px] font-medium tabular-nums"
                style={{ color: `rgb(${identity.tint.join(" ")} / 0.75)` }}
              >
                %
              </span>
            </div>
            <div className="flex-1 min-w-0 space-y-0.5">
              <MiniProbBar value={event.probability} size="xs" hoverBoost />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0 text-[9px] scry-text-tertiary">
                {baseline != null && <span>from {baseline}%</span>}
                {event.confidence != null && (
                  <span className="text-violet-400/55">{Math.round(event.confidence)}% conf</span>
                )}
                {event.movement_delta != null && event.movement_delta !== 0 && (
                  <MoveBadge delta={event.movement_delta} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Secondary */}
      {(event.why_it_matters || event.reputation_impact) && (
        <div className="space-y-1 border-t border-zinc-800/35 pt-2.5">
          {event.why_it_matters && (
            <p className="text-[11px] scry-text-secondary leading-snug line-clamp-2">
              <span className="scry-text-tertiary">Why it matters · </span>
              {event.why_it_matters}
            </p>
          )}
          {event.reputation_impact && (
            <p className="text-[10px] text-amber-400/55 tabular-nums">
              Rep impact · {event.reputation_impact}
            </p>
          )}
        </div>
      )}

      {/* Credibility — compact */}
      {event.credibility_split && (
        <div className="pt-1 min-w-0">
          <CredibilityMiniBar split={event.credibility_split} spread={event.disagreement_spread} />
        </div>
      )}

      {/* Intelligence — compact inline */}
      {reasoning && (reasoning.who_moved_first || reasoning.who_disagrees || reasoning.narrative_driver || consensusSplit) && (
        <div
          className={`grid gap-1 sm:grid-cols-2 pt-1 min-w-0 ${
            expanded ? "" : "feed-intel-compact"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <IntelRow icon="→" label="First" value={reasoning.who_moved_first} />
          <IntelRow icon="≠" label="Disagrees" value={reasoning.who_disagrees} />
          <IntelRow icon="◈" label="Narrative" value={reasoning.narrative_driver} />
          <IntelRow icon="◎" label="Split" value={consensusSplit} />
        </div>
      )}

      {/* Expanded detail */}
      {expanded && reasoning?.why_now && (
        <p className="text-[10px] scry-text-tertiary leading-snug border-t border-zinc-800/35 pt-2.5">
          {reasoning.why_now}
        </p>
      )}

      {/* Tertiary metadata */}
      {(event.agent.streak != null || event.rank_reasons?.length) && density !== "compact" && (
        <p className="text-[9px] scry-text-tertiary truncate">
          {event.agent.streak != null && <span>{event.agent.streak}w streak</span>}
          {event.rank_reasons?.[0] && (
            <span>
              {event.agent.streak != null ? " · " : ""}
              {event.rank_reasons[0]}
            </span>
          )}
        </p>
      )}

      <FeedInteractionHighlights summary={summary} />

      <FeedInteractionModal
        kind="back"
        open={backOpen}
        onClose={() => setBackOpen(false)}
        event={event}
        existing={userRead?.interaction_type === "back" ? userRead : null}
        onSuccess={onInteractionSuccess}
      />
      <FeedInteractionModal
        kind="challenge"
        open={challengeOpen}
        onClose={() => setChallengeOpen(false)}
        event={event}
        existing={userRead?.interaction_type === "challenge" ? userRead : null}
        onSuccess={onInteractionSuccess}
      />

      {/* Public read + capital actions */}
      <div
        className="pt-2.5 mt-auto border-t border-zinc-800/40 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className="text-[8px] uppercase tracking-wider text-zinc-600">
            Network read
          </span>
          <FeedInteractionStats summary={summary} />
          <span className="text-[8px] uppercase tracking-wider text-zinc-600 ml-auto">
            Your call
          </span>
        </div>

        <div className="flex flex-wrap items-stretch gap-2">
          <div className="flex flex-1 min-w-[min(100%,12rem)] gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (!requireAuth()) return;
                setBackOpen(true);
              }}
              className={`scry-tap-target feed-chip-active flex-1 min-h-[40px] text-[11px] font-medium px-3 py-2 rounded-lg border transition ${
                userRead?.interaction_type === "back"
                  ? "text-emerald-100 border-emerald-500/35 bg-emerald-500/15"
                  : "text-zinc-300 border-zinc-700/80 bg-zinc-900/50 hover:border-emerald-500/30 hover:text-emerald-200"
              }`}
            >
              Back This
            </button>
            <button
              type="button"
              onClick={() => {
                if (!requireAuth()) return;
                setChallengeOpen(true);
              }}
              className={`scry-tap-target feed-chip-active flex-1 min-h-[40px] text-[11px] font-medium px-3 py-2 rounded-lg border transition ${
                userRead?.interaction_type === "challenge"
                  ? "text-rose-100 border-rose-500/40 bg-rose-500/18"
                  : "text-zinc-300 border-zinc-700/80 bg-zinc-900/50 hover:border-rose-500/35 hover:text-rose-200"
              }`}
            >
              Challenge
            </button>
          </div>

          <Link
            href={`/agents/${event.agent.slug}`}
            className="scry-tap-target feed-chip-active shrink-0 min-h-[40px] inline-flex items-center text-[11px] font-medium text-zinc-200 px-3 py-2 rounded-lg border border-violet-500/25 bg-violet-500/10 hover:bg-violet-500/18 hover:text-white transition"
          >
            Follow Agent
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
        {battleHref && (
          <Link
            href={battleHref}
            className="feed-chip-active text-[10px] text-zinc-400 hover:text-rose-300 px-2 py-1 rounded-md hover:bg-rose-500/10 transition"
          >
            View Rivalry
          </Link>
        )}
        {seasonHref && (
          <Link
            href={seasonHref}
            className="feed-chip-active text-[10px] text-zinc-400 hover:text-amber-300 px-2 py-1 rounded-md hover:bg-amber-500/10 transition"
          >
            {event.season_title ? `${event.season_title}` : "View season"}
          </Link>
        )}
        {marketHref && (
          <Link
            href={marketHref}
            className="feed-chip-active text-[10px] text-zinc-500 hover:text-violet-300 px-2 py-1 rounded-md hover:bg-violet-500/10 transition"
          >
            View narrative
          </Link>
        )}
        {verifiedHref && event.type === "receipt" && (
          <Link
            href={verifiedHref}
            className="feed-chip-active text-[10px] text-zinc-500 hover:text-emerald-300 px-2 py-1 rounded-md transition hidden xs:inline"
          >
            View receipt
          </Link>
        )}
        </div>
      </div>
    </article>
  );
}
