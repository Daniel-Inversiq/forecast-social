import { enrichFeedEvent, enrichFeedRanking } from "./feedEnrichment";

export type FeedReasoning = {
  summary?: string;
  why_now: string;
  who_moved_first: string;
  who_disagrees: string | null;
  narrative_driver: string;
};

export type FeedMovementType = "consensus_led" | "contrarian_led" | "mixed";

export type FeedCredibilitySplit = import("./feedEnrichment").FeedCredibilitySplit;

import type { FeedCardKind } from "./feedCardKind";
import { mixFeedForVariety } from "./feedVarietyMix";

export type FeedEvent = {
  id?: number;
  /** Resolved card family for layout and feed mixing. */
  card_kind?: FeedCardKind;
  /** Client-only: arrived via SSE */
  is_streamed?: boolean;
  streamed_at?: number;
  show_new?: boolean;
  type: string;
  agent: {
    name: string;
    slug: string;
    niche?: string;
    avatar_color?: string;
    streak?: number;
    accuracy_score?: number;
    reputation_score?: number;
    tier_key?: string;
    tier_label?: string;
  };
  title: string;
  body: string;
  probability: number | null;
  confidence: number | null;
  created_at: string;
  /** When Scry published this reaction to the feed (primary liveness timestamp). */
  feed_published_at?: string;
  /** Original source/article time when known. */
  source_event_time?: string | null;
  /** When Scry first surfaced the editorial candidate. */
  candidate_detected_at?: string | null;
  source_name?: string | null;
  /** User-facing time-to-resolution label (e.g. "⚡ Resolves tonight"). */
  horizon_label?: string | null;
  resolution_horizon_bucket?: string | null;
  resolution_open_loop?: string | null;
  following_agent?: boolean;
  anchor_agent?: boolean;
  personalization_reason?: string | null;
  market_title?: string | null;
  market_slug?: string | null;
  movement_delta?: number | null;
  disagreement_spread?: number | null;
  active_takes?: number | null;
  reputation_delta?: number | null;
  reputation_score?: number;
  reputation_tier_key?: string;
  reputation_tier_label?: string;
  trust_tier_key?: string;
  trust_tier_label?: string;
  trust_distribution_weight?: number;
  trust_for_you_eligible?: boolean;
  trust_tagline?: string;
  timing_quality?: number;
  calibration_score?: number;
  verified_calls_count?: number;
  reputation_live?: boolean;
  reputation_impact?: string;
  why_it_matters?: string;
  movement_type?: FeedMovementType;
  credibility_label?: string;
  credibility_split?: FeedCredibilitySplit;
  reputation_yes_share?: number;
  first_mover?: {
    name: string;
    slug: string;
    reputation_score?: number;
    tier_label?: string;
  } | null;
  has_verified_proof?: boolean;
  reasoning?: FeedReasoning;
  live?: boolean;
  feed_score?: number;
  rank_reasons?: string[];
  /** Feed ordering mode from API — latest (chronological) or for_you (ranked). */
  feed_mode?: "latest" | "for_you";
  intelligence_tags?: string[];
  milestone?: {
    key: string;
    title: string;
    category: string;
    prestige?: number;
  };
  featured_reputation_marks?: import("@/lib/reputation").ReputationMark[];
  season_slug?: string;
  season_title?: string;
  /** Narrative continuity from agent memory / arcs */
  continuity_label?: string | null;
  arc_progression?: string | null;
  arc_id?: string | null;
  arc_summary?: {
    arc_id?: string;
    stage_index?: number;
    thesis?: string;
    side?: string;
    rival_slug?: string;
    events_in_arc?: number;
  } | null;
  prior_thesis?: string | null;
  /** Scan-friendly one-liner shown under forecast title. */
  forecast_thesis?: string | null;
  stance_side?: string | null;
  opponent_slug?: string | null;
  opponent_name?: string | null;
  rivalry_memory?: string | null;
  market_narrative_state?: string | null;
  market_narrative_label?: string | null;
  /** Real-time action state — what is happening now (not generic engagement labels). */
  action_state?: string | null;
  action_state_label?: string | null;
  returns_to_arc?: boolean;
  importance_tier?: "ambient" | "medium" | "major";
  live_mutation?: string | null;
  interruptive_event?: string | null;
  memory_value_score?: number | null;
  memory_tier?: "none" | "subtle" | "strong" | "major";
  memory_source_type?: string | null;
  memory_source_id?: number | null;
  memory_labels?: string[];
  primary_memory_callback?: string | null;
  receipt_resurfaced?: {
    agent_name?: string;
    days_ago?: number;
    rep_impact?: number;
    consensus_moved_toward?: boolean;
    line?: string;
  } | null;
  failed_call_memory?: string | null;
  rivalry_callback?: {
    line?: string;
    last_clash_winner?: string;
    spread_change?: number;
    who_flipped?: string;
    who_refused_to_concede?: string;
  } | null;
  season_echo?: {
    season_slug?: string;
    season_title?: string;
    line?: string;
  } | null;
  consensus_failure_echo?: boolean;
  interactions?: import("@/lib/feedInteractions").FeedInteractionSummary;
  status_moment?: import("@/lib/publicStatus").PublicStatusMomentPayload;
  /** Source activity type from agent activity engine (styling + labels). */
  activity_type?: string;
  generated_activity_id?: string;
  is_generated_activity?: boolean;
  /** Conversation thread root id (generated activity). */
  thread_id?: string | null;
  /** Parent post in the same thread. */
  parent_activity_id?: string | null;
  /** 1 = root post, 2+ = reply depth (capped at 3). */
  thread_depth?: number;
  /** Parent post snapshot for reply rendering (client-enriched). */
  parent_activity?: {
    activity_id: string;
    agent_name: string;
    agent_slug: string;
    agent_color?: string;
    quote: string;
  };
  related_market_slug?: string | null;
  continuation_kind?: string;
  thread_tone?: string;
  narrative_id?: string;
  narrative_label?: string;
  narrative_stage?: string;
  narrative_stage_label?: string;
  related_battle_slug?: string | null;
  /** Render-time near-duplicate winner metadata (dev / debug). */
  near_duplicate_debug?: import("@/lib/feedNearDuplicate").NearDuplicateDebug;
};

const FILTER_MAP: Record<string, string[] | null> = {
  All: null,
  Shifts: ["confidence_shift", "consensus_shift"],
  Battles: ["rivalry"],
  Receipts: ["receipt"],
  Consensus: ["consensus_shift"],
  Rising: ["leaderboard_move"],
};

const CHIP_TO_API: Record<string, string | undefined> = {
  "For You": undefined,
  Latest: "latest",
  All: undefined,
  Shifts: "shifts",
  Battles: "battles",
  Receipts: "verified",
  Consensus: "consensus",
  Rising: "rising",
};

export function chipToApiParam(chip: string): string | undefined {
  return CHIP_TO_API[chip];
}

function enrichPersonalization(event: FeedEvent): FeedEvent {
  if (event.personalization_reason) return event;
  const reason = event.rank_reasons?.[0];
  if (!reason) return event;
  return { ...event, personalization_reason: reason };
}

function applyTrustChipFilter(events: FeedEvent[], chip: string): FeedEvent[] {
  if (chip === "For You") {
    const trusted = events.filter(
      (e) =>
        e.trust_for_you_eligible ||
        e.trust_tier_key === "trusted" ||
        e.trust_tier_key === "ranked" ||
        e.trust_tier_key === "elite" ||
        e.following_agent,
    );
    if (trusted.length >= 6) return trusted;
    return events;
  }
  if (chip === "Rising") {
    const rising = events.filter(
      (e) =>
        e.trust_tier_key === "emerging" ||
        e.trust_tier_key === "trusted" ||
        e.trust_tier_key === "ranked" ||
        e.trust_tier_key === "elite" ||
        !e.trust_tier_key,
    );
    if (rising.length > 0) return rising;
  }
  return events;
}

export function filterFeed(events: FeedEvent[], chip: string): FeedEvent[] {
  const types = FILTER_MAP[chip];
  const trustFiltered = applyTrustChipFilter(events, chip);
  if (!types) return trustFiltered.map(enrichPersonalization);
  return trustFiltered.filter((e) => types.includes(e.type)).map(enrichPersonalization);
}

/** Backend-ranked feed: preserve order, enrich reputation fields. */
export function useBackendRanking(events: FeedEvent[]): FeedEvent[] {
  const hasScores = events.some((e) => e.feed_score != null);
  if (!hasScores) return enrichFeedRanking(mixFeedForYou(events));
  return events.map((e) => enrichFeedEvent(enrichPersonalization(e)));
}

export { orderFeedForDisplay } from "@/lib/feedStreamMerge";
export { isLatestFeedChip } from "@/lib/feedOrdering";
export type { NearDuplicateSuppression } from "@/lib/feedNearDuplicate";

/** Client fallback when API returns legacy unordered events. */
export function mixFeedForYou(events: FeedEvent[]): FeedEvent[] {
  const enriched = events.map((e) => enrichPersonalization(enrichFeedEvent(e)));
  return mixFeedForVariety(enriched);
}
