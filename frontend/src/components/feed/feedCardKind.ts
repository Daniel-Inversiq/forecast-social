import { resolveFeedActionLabel } from "@/lib/feedActionStates";
import type { FeedEvent } from "./feedMix";

/** Five feed card families — distinct layout and narrative role. */
export type FeedCardKind =
  | "open_battle"
  | "receipt"
  | "failed_call"
  | "agent_post"
  | "network_event";

export const OPEN_BATTLE_MAX_SHARE = 0.35;

const OPEN_BATTLE_TYPES = new Set(["rivalry", "battle_escalation"]);

const RECEIPT_TYPES = new Set(["receipt", "verified_call"]);

const FAILED_TYPES = new Set(["failed_high_conviction_call"]);

const AGENT_POST_TYPES = new Set([
  "new_take",
  "position_update",
  "stance_followup",
  "quiet_pulse",
  "confidence_shift",
  "market_move",
  "signal_shift",
]);

const NETWORK_EVENT_TYPES = new Set([
  "leaderboard_move",
  "reputation_move",
  "milestone_unlock",
  "consensus_shift",
  "narrative_acceleration",
  "calibration_jump",
  "season_shift",
  "season_lead",
  "season_arc",
  "season_collapse",
]);

const ACTIVITY_CARD_KIND: Record<string, FeedCardKind> = {
  agent_post: "agent_post",
  conviction_update: "agent_post",
  battle_response: "open_battle",
  rival_reply: "open_battle",
  receipt_reaction: "receipt",
  receipt_challenge: "open_battle",
  receipt_victory: "receipt",
  market_position_update: "agent_post",
  network_pulse: "network_event",
  network_briefing_item: "network_event",
};

export function resolveFeedCardKind(event: FeedEvent): FeedCardKind {
  if (event.card_kind) return event.card_kind;
  if (event.activity_type && event.activity_type in ACTIVITY_CARD_KIND) {
    return ACTIVITY_CARD_KIND[event.activity_type];
  }

  const type = event.type;

  if (FAILED_TYPES.has(type)) return "failed_call";
  if (RECEIPT_TYPES.has(type) && isFailedReceipt(event)) return "failed_call";
  if (RECEIPT_TYPES.has(type)) return "receipt";
  if (OPEN_BATTLE_TYPES.has(type)) return "open_battle";
  if (NETWORK_EVENT_TYPES.has(type)) return "network_event";
  if (AGENT_POST_TYPES.has(type)) return "agent_post";

  if (type === "public_status") return "network_event";
  if ((event.disagreement_spread ?? 0) >= 28 && event.opponent_name) return "open_battle";

  return "agent_post";
}

function isFailedReceipt(event: FeedEvent): boolean {
  const delta = event.reputation_delta ?? 0;
  return delta < 0 || Boolean(event.failed_call_memory);
}

export function isOpenBattleKind(kind: FeedCardKind): boolean {
  return kind === "open_battle";
}

export function feedCardKindLabel(kind: FeedCardKind, event?: FeedEvent): string {
  if (event) {
    if (event.action_state_label) return event.action_state_label;
    if (kind === "open_battle" || kind === "network_event" || kind === "agent_post") {
      return resolveFeedActionLabel(event);
    }
  }
  if (event?.type === "leaderboard_move" || event?.type === "reputation_move") {
    return "Trust Shift";
  }
  switch (kind) {
    case "open_battle":
      return "Rivalry Active";
    case "receipt":
      return "Verified receipt";
    case "failed_call":
      return "Wrong call";
    case "agent_post":
      return "Consensus Forming";
    case "network_event":
      return "Trust Shift";
  }
}
