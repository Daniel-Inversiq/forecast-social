import type { FeedEvent } from "./feedMix";

export type GeneratedActivityType =
  | "agent_post"
  | "conviction_update"
  | "battle_response"
  | "rival_reply"
  | "receipt_reaction"
  | "receipt_challenge"
  | "receipt_victory"
  | "market_position_update"
  | "network_pulse"
  | "network_briefing_item";

export const GENERATED_ACTIVITY_TYPES = new Set<string>([
  "agent_post",
  "conviction_update",
  "battle_response",
  "rival_reply",
  "receipt_reaction",
  "receipt_challenge",
  "receipt_victory",
  "market_position_update",
  "network_pulse",
  "network_briefing_item",
]);

export const ACTIVITY_TYPE_LABEL_TONE: Record<GeneratedActivityType, string> = {
  agent_post: "text-violet-400/70",
  conviction_update: "text-amber-400/75",
  battle_response: "text-rose-400/80",
  rival_reply: "text-rose-400/80",
  receipt_reaction: "text-emerald-400/80",
  receipt_challenge: "text-rose-400/85",
  receipt_victory: "text-emerald-400/85",
  market_position_update: "text-sky-400/75",
  network_pulse: "text-amber-400/75",
  network_briefing_item: "text-amber-400/75",
};

export const ACTIVITY_TYPE_SURFACE: Record<GeneratedActivityType, string> = {
  agent_post: "feed-post-card--activity-agent-post",
  conviction_update: "feed-post-card--activity-conviction",
  battle_response: "feed-post-card--activity-battle",
  rival_reply: "feed-post-card--activity-battle",
  receipt_reaction: "feed-post-card--activity-receipt",
  receipt_challenge: "feed-post-card--activity-battle",
  receipt_victory: "feed-post-card--activity-receipt",
  market_position_update: "feed-post-card--activity-position",
  network_pulse: "feed-post-card--activity-briefing",
  network_briefing_item: "feed-post-card--activity-briefing",
};

export function isGeneratedActivityType(
  value: string | undefined | null,
): value is GeneratedActivityType {
  return Boolean(value && GENERATED_ACTIVITY_TYPES.has(value));
}

/** Activity-type labels are not shown in feed UI after the feed-first refactor. */
export function resolveActivityTypeLabel(_event: FeedEvent): string | null {
  return null;
}

export function resolveActivityTypeTone(event: FeedEvent): string | null {
  if (!isGeneratedActivityType(event.activity_type)) return null;
  return ACTIVITY_TYPE_LABEL_TONE[event.activity_type];
}

export function resolveActivityTypeSurface(event: FeedEvent): string | null {
  if (!isGeneratedActivityType(event.activity_type)) return null;
  return ACTIVITY_TYPE_SURFACE[event.activity_type];
}

export function resolveGeneratedActivityHint(_event: FeedEvent): string | null {
  return null;
}

export function isMainFeedActivityType(value: string | undefined | null): boolean {
  return isGeneratedActivityType(value) && value !== "network_briefing_item";
}
