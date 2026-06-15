import type { FeedEvent } from "@/components/feed/feedMix";
import type { ArcThreadKind } from "@/components/feed/arcThreadGroups";
import type { OngoingStory } from "@/lib/ongoingStories";

export type FeedActionStateKey =
  | "watch_live"
  | "follow_thread"
  | "consensus_forming"
  | "rivalry_active"
  | "market_repricing"
  | "verdict_pending"
  | "resolution_near"
  | "trust_shift";

export const FEED_ACTION_STATE_LABELS: Record<FeedActionStateKey, string> = {
  watch_live: "Watch Live",
  follow_thread: "Follow Thread",
  consensus_forming: "Consensus Forming",
  rivalry_active: "Rivalry Active",
  market_repricing: "Market Repricing",
  verdict_pending: "Verdict Pending",
  resolution_near: "Resolution Near",
  trust_shift: "Trust Shift",
};

export function actionStateLabel(key: FeedActionStateKey | string | null | undefined): string | null {
  if (!key) return null;
  return FEED_ACTION_STATE_LABELS[key as FeedActionStateKey] ?? null;
}

export function actionStateCta(key: FeedActionStateKey | string | null | undefined): string | null {
  const label = actionStateLabel(key);
  return label ? `${label} →` : null;
}

const REPRICING_STATES = new Set([
  "panic repricing",
  "volatility spike",
  "fragmenting",
  "mania phase",
]);

const CONSENSUS_STATES = new Set(["consensus building", "coalition forming", "stabilization"]);

export function resolveFeedActionState(event: FeedEvent): FeedActionStateKey {
  if (event.action_state) return event.action_state as FeedActionStateKey;

  if (event.live || event.show_new || event.is_streamed) return "watch_live";

  const bucket = event.resolution_horizon_bucket;
  if (bucket === "tonight" || bucket === "soon" || event.resolution_open_loop) {
    return "resolution_near";
  }

  if (
    event.type === "reputation_move" ||
    event.type === "leaderboard_move" ||
    event.type === "calibration_jump"
  ) {
    return "trust_shift";
  }

  if (event.type === "rivalry" || event.type === "battle_escalation") return "rivalry_active";

  if (event.type === "consensus_shift" || event.type === "narrative_acceleration") {
    return "consensus_forming";
  }

  const marketState = event.market_narrative_state?.toLowerCase() ?? "";
  if (CONSENSUS_STATES.has(marketState)) return "consensus_forming";
  if (
    event.type === "market_move" ||
    event.type === "signal_shift" ||
    event.type === "confidence_shift" ||
    REPRICING_STATES.has(marketState)
  ) {
    return "market_repricing";
  }

  if (event.arc_progression?.toLowerCase() === "receipt pending") return "verdict_pending";

  const spread = event.disagreement_spread ?? 0;
  if (spread >= 28 && (event.type === "rivalry" || event.opponent_name)) return "verdict_pending";

  if (event.arc_id || event.returns_to_arc || event.continuity_label) return "follow_thread";

  if (event.type === "new_take" || event.type === "stance_followup" || event.type === "position_update") {
    return "consensus_forming";
  }

  return "follow_thread";
}

export function resolveFeedActionLabel(event: FeedEvent): string {
  return actionStateLabel(resolveFeedActionState(event)) ?? "Follow Thread";
}

export function resolveOngoingStoryActionState(story: OngoingStory): FeedActionStateKey {
  if (story.action_state) return story.action_state as FeedActionStateKey;

  if (story.is_live) return "watch_live";

  const resolution = story.resolution_line?.toLowerCase() ?? "";
  if (
    resolution.includes("tonight") ||
    resolution.includes("soon") ||
    resolution.includes("48h") ||
    resolution.includes("resolves")
  ) {
    return "resolution_near";
  }

  if (story.story_type === "rivalry") {
    if (story.battle_strength === "heated" || story.battle_strength === "legendary") {
      return "rivalry_active";
    }
    return "verdict_pending";
  }

  if (story.story_type === "arc") {
    if (story.arc_stage?.toLowerCase() === "receipt pending") return "verdict_pending";
    return "follow_thread";
  }

  if (story.story_type === "market") return "market_repricing";

  return "verdict_pending";
}

export function resolveArcThreadActionPrefix(
  kind: ArcThreadKind,
  opts: { isActiveStory?: boolean; isLive?: boolean; latestStage?: string | null },
): string {
  if (opts.isLive) return actionStateLabel("watch_live") ?? "Watch Live";

  const stage = opts.latestStage?.toLowerCase() ?? "";
  if (stage === "receipt pending") return actionStateLabel("verdict_pending") ?? "Verdict Pending";

  if (opts.isActiveStory) {
    if (kind === "rivalry") return actionStateLabel("rivalry_active") ?? "Rivalry Active";
    if (kind === "market") return actionStateLabel("market_repricing") ?? "Market Repricing";
    if (kind === "continuing") return actionStateLabel("follow_thread") ?? "Follow Thread";
    if (kind === "aftermath") return actionStateLabel("trust_shift") ?? "Trust Shift";
  }

  if (kind === "rivalry") return actionStateLabel("verdict_pending") ?? "Verdict Pending";
  if (kind === "market") return actionStateLabel("consensus_forming") ?? "Consensus Forming";
  if (kind === "continuing") return actionStateLabel("follow_thread") ?? "Follow Thread";
  return actionStateLabel("trust_shift") ?? "Trust Shift";
}
