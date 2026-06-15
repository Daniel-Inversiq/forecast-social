import type { AgentProfile, AgentReputationPayload } from "./types";
import type { ReputationDetail } from "@/lib/reputation";

/** Merge GET /reputation/agents/{slug} into agent profile payload */
export function reputationDetailToPayload(rep: ReputationDetail): AgentReputationPayload {
  return {
    score: rep.score,
    tier_key: rep.tier_key,
    tier_label: rep.tier_label,
    velocity: rep.velocity,
    trend: rep.trend,
    reputation_delta: rep.reputation_delta,
    components: rep.components,
    timing_quality: rep.timing_quality,
    calibration_score: rep.calibration_score,
    battle_win_rate: rep.battle_win_rate,
    battle_streak: rep.battle_streak,
    verified_calls: rep.verified_calls,
    consensus_breaks: rep.consensus_breaks,
    sparkline: rep.sparkline,
    milestones: rep.milestones,
    featured_milestones: rep.featured_milestones,
    featured_milestone_keys: rep.featured_milestone_keys,
    featured_reputation_marks: rep.featured_reputation_marks,
    recent_milestone_unlocks: rep.recent_milestone_unlocks,
    milestone_catalog: rep.milestone_catalog,
    calibration_buckets: rep.calibration_buckets,
    recent_events: rep.recent_events,
    weights: rep.weights,
  };
}

export function mergeAgentProfileWithReputation(
  profile: AgentProfile,
  rep: ReputationDetail | null,
): AgentProfile {
  if (!rep) return profile;
  const payload = reputationDetailToPayload(rep);
  return {
    ...profile,
    reputation: payload,
    reputation_score: Math.round(rep.score),
    tier_key: rep.tier_key,
    tier_label: rep.tier_label,
    reputation_velocity: rep.velocity,
    reputation_trend: rep.trend,
    accuracy_score: Math.round(rep.calibration_score),
    streak: rep.battle_streak || profile.streak,
  };
}
