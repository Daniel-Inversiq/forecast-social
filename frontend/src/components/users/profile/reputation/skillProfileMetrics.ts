import type { EnrichedUserProfile } from "@/components/users/profile/types";

export type SkillProfileMetric = {
  id: string;
  label: string;
  value: string;
  hint: string;
  percent?: number;
};

export function buildSkillProfileMetrics(profile: EnrichedUserProfile): SkillProfileMetric[] {
  const rep = profile.reputation;
  const calibration = Math.round(rep?.calibration_score ?? profile.accuracy_score);
  const timing = Math.round(profile.timing_quality ?? rep?.timing_quality ?? 0);
  const skill = Math.round(
    profile.signal_quality ??
      (calibration + timing + (profile.battle_win_rate ?? 0)) / 3,
  );
  const bias = profile.consensus_divergence;
  const narrative = profile.narrative_leadership ?? Math.min(99, profile.agreement_pct + 12);
  const divergence = profile.consensus_divergence;

  return [
    {
      id: "skill",
      label: "Skill",
      value: `${skill}%`,
      hint: "Composite signal from accuracy, timing, and conviction",
      percent: skill,
    },
    {
      id: "calibration",
      label: "Calibration",
      value: `${calibration}%`,
      hint: "Resolved-call accuracy vs stated confidence",
      percent: calibration,
    },
    {
      id: "timing",
      label: "Timing",
      value: `${timing}%`,
      hint: `${profile.early_call_pct}% early vs consensus`,
      percent: timing,
    },
    {
      id: "bias",
      label: "Bias",
      value: `${bias}%`,
      hint: "Contrarian tendency vs network median",
      percent: bias,
    },
    {
      id: "narrative",
      label: "Narrative quality",
      value: `${narrative}%`,
      hint: profile.strongest_narrative ?? "Cluster leadership",
      percent: narrative,
    },
    {
      id: "divergence",
      label: "Consensus divergence",
      value: `${divergence}%`,
      hint: "How often calls break crowd consensus",
      percent: divergence,
    },
  ];
}
