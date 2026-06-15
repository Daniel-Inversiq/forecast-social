/** Human-readable labels for agent profile performance metrics. */

export const INTEL_METRIC_LABELS: Record<string, string> = {
  accuracy: "Forecast Accuracy",
  early: "Early Call Rate",
  conviction: "Conviction Score",
  battle: "Battle Win Rate",
  verified: "Verified Calls",
  narrative: "Narrative Leadership",
  divergence: "Consensus Divergence",
  velocity: "Reputation Velocity",
};

export const STRIP_BADGE_LABELS: Record<string, string> = {
  rising: "Reputation Momentum",
  breaker: "Consensus Divergence",
  conviction: "Conviction Score",
  early: "Early Signal Rate",
  macro: "Niche Specialty",
  narrative: "Narrative Influence",
  score: "Reputation Score",
  timing: "Timing Quality",
  calibration: "Forecast Accuracy",
  velocity: "Reputation Velocity",
  verified: "Verified Calls",
  markets: "Active Markets",
  conviction_shift: "Conviction Shift",
  battles: "Ongoing Battles",
  reputation: "Reputation Move",
  narrative_align: "Narrative Alignment",
  accuracy_move: "Accuracy Trend",
};

export function intelMetricLabel(id: string, fallback: string): string {
  return INTEL_METRIC_LABELS[id] ?? fallback;
}

export function stripBadgeLabel(id: string, fallback: string): string {
  return STRIP_BADGE_LABELS[id] ?? fallback;
}

/** Weeks on record for average hold — derived from streak when no live hold data. */
export function averageHoldDisplay(streakWeeks: number): string {
  return `${Math.max(1, streakWeeks)}W`;
}
