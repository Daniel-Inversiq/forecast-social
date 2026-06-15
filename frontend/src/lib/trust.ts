/**
 * SCRY Trust Distribution — earned through forecasting quality, not payment or volume.
 */

import { apiFetch } from "@/lib/api";

export const DISTRIBUTION_TAGLINE = "Distribution unlocked through trust.";

export type TrustTierKey =
  | "observer"
  | "emerging"
  | "trusted"
  | "ranked"
  | "elite"
  | "verified";

export type TrustedRequirements = {
  resolved_calls: number;
  credibility: number;
  account_age_days: number;
  abuse_flags_max: number;
};

export const TRUSTED_REQUIREMENTS: TrustedRequirements = {
  resolved_calls: 20,
  credibility: 100,
  account_age_days: 14,
  abuse_flags_max: 0,
};

export type TrustTierDef = {
  key: TrustTierKey;
  label: string;
  distributionWeight: number;
  utilities: string[];
};

export const TRUST_TIERS: TrustTierDef[] = [
  {
    key: "observer",
    label: "Observer",
    distributionWeight: 0.35,
    utilities: ["Can forecast", "Can challenge", "Minimal distribution"],
  },
  {
    key: "emerging",
    label: "Emerging",
    distributionWeight: 0.65,
    utilities: ["Limited feed distribution", "Appears in Rising section"],
  },
  {
    key: "trusted",
    label: "Trusted",
    distributionWeight: 1.0,
    utilities: [
      "Eligible for For You feed",
      "Can start narratives",
      "Can appear in Public Reads",
      "Eligible for Ranked Battles",
    ],
  },
  {
    key: "ranked",
    label: "Ranked",
    distributionWeight: 1.35,
    utilities: ["Featured in leaderboards", "Increased distribution weight"],
  },
  {
    key: "elite",
    label: "Elite",
    distributionWeight: 1.65,
    utilities: ["Priority feed distribution", "Featured forecaster"],
  },
  {
    key: "verified",
    label: "Verified",
    distributionWeight: 1.0,
    utilities: ["Identity verification layer"],
  },
];

export const TRUST_TIER_STYLES: Record<string, { badge: string; glow: string }> = {
  observer: { badge: "text-zinc-500 bg-zinc-900/60 border-zinc-800/80", glow: "" },
  emerging: { badge: "text-zinc-400 bg-zinc-800/60 border-zinc-700/50", glow: "" },
  trusted: { badge: "text-sky-200 bg-sky-500/10 border-sky-500/30", glow: "shadow-sky-500/10" },
  ranked: { badge: "text-violet-200 bg-violet-500/10 border-violet-500/30", glow: "shadow-violet-500/15" },
  elite: { badge: "text-amber-200 bg-amber-500/10 border-amber-500/30", glow: "shadow-amber-500/15" },
  verified: { badge: "text-emerald-200 bg-emerald-500/10 border-emerald-500/30", glow: "shadow-emerald-500/15" },
};

export type TrustInputs = {
  resolvedCalls: number;
  credibility: number;
  accountAgeDays: number;
  abuseFlags?: number;
  calibrationScore?: number;
  reputationScore?: number;
  identityVerified?: boolean;
};

export type TrustEvaluation = {
  tierKey: TrustTierKey;
  tierLabel: string;
  distributionWeight: number;
  utilities: string[];
  meetsTrusted: boolean;
  identityVerified: boolean;
  forYouEligible: boolean;
  risingEligible: boolean;
  leaderboardFeatured: boolean;
  trustedProgress: {
    resolvedCalls: { current: number; required: number };
    credibility: { current: number; required: number };
    accountAgeDays: { current: number; required: number };
    abuseFlags: { current: number; required: number };
  };
};

export const EMERGING_RESOLVED_MIN = 3;

export const RANKED_THRESHOLDS = { resolvedCalls: 35, credibility: 140, calibrationMin: 60 };
export const ELITE_THRESHOLDS = {
  resolvedCalls: 50,
  credibility: 180,
  reputationMin: 72,
  calibrationMin: 65,
};

export function meetsTrustedRequirements(input: TrustInputs): boolean {
  const abuse = input.abuseFlags ?? 0;
  return (
    input.resolvedCalls >= TRUSTED_REQUIREMENTS.resolved_calls &&
    input.credibility >= TRUSTED_REQUIREMENTS.credibility &&
    input.accountAgeDays >= TRUSTED_REQUIREMENTS.account_age_days &&
    abuse <= TRUSTED_REQUIREMENTS.abuse_flags_max
  );
}

export function accountAgeDaysFromIso(memberSince: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(memberSince).getTime()) / 86400000));
}

export function resolveTrustTier(input: TrustInputs): TrustEvaluation {
  const calibration = input.calibrationScore ?? 50;
  const reputation = input.reputationScore ?? input.credibility;
  const meetsTrusted = meetsTrustedRequirements(input);
  const abuse = input.abuseFlags ?? 0;

  let tierKey: TrustTierKey;
  if (input.resolvedCalls < 3) {
    tierKey = "observer";
  } else if (!meetsTrusted) {
    tierKey = "emerging";
  } else if (
    input.resolvedCalls >= ELITE_THRESHOLDS.resolvedCalls &&
    input.credibility >= ELITE_THRESHOLDS.credibility &&
    reputation >= ELITE_THRESHOLDS.reputationMin &&
    calibration >= ELITE_THRESHOLDS.calibrationMin
  ) {
    tierKey = "elite";
  } else if (
    input.resolvedCalls >= RANKED_THRESHOLDS.resolvedCalls &&
    input.credibility >= RANKED_THRESHOLDS.credibility &&
    calibration >= RANKED_THRESHOLDS.calibrationMin
  ) {
    tierKey = "ranked";
  } else {
    tierKey = "trusted";
  }

  const def = TRUST_TIERS.find((t) => t.key === tierKey) ?? TRUST_TIERS[0];
  const utilities = [...def.utilities];
  if (input.identityVerified) {
    utilities.push("Verified identity layer");
  }

  return {
    tierKey,
    tierLabel: def.label,
    distributionWeight: def.distributionWeight,
    utilities,
    meetsTrusted,
    identityVerified: Boolean(input.identityVerified),
    forYouEligible: tierKey === "trusted" || tierKey === "ranked" || tierKey === "elite",
    risingEligible: tierKey !== "observer",
    leaderboardFeatured: tierKey === "ranked" || tierKey === "elite",
    trustedProgress: {
      resolvedCalls: {
        current: input.resolvedCalls,
        required: TRUSTED_REQUIREMENTS.resolved_calls,
      },
      credibility: {
        current: Math.round(input.credibility),
        required: TRUSTED_REQUIREMENTS.credibility,
      },
      accountAgeDays: {
        current: input.accountAgeDays,
        required: TRUSTED_REQUIREMENTS.account_age_days,
      },
      abuseFlags: {
        current: abuse,
        required: TRUSTED_REQUIREMENTS.abuse_flags_max,
      },
    },
  };
}

export type TrustApiFields = {
  trust_tier_key?: string;
  trust_tier_label?: string;
  trust_distribution_weight?: number;
  trust_tagline?: string;
  trust_meets_trusted_requirements?: boolean;
  trust_for_you_eligible?: boolean;
  trust_leaderboard_featured?: boolean;
  trust_identity_verified?: boolean;
};

export function trustFromApiFields(fields: TrustApiFields): TrustEvaluation | null {
  if (!fields.trust_tier_key) return null;
  const key = fields.trust_tier_key as TrustTierKey;
  const def = TRUST_TIERS.find((t) => t.key === key);
  if (!def) return null;
  return {
    tierKey: key,
    tierLabel: fields.trust_tier_label ?? def.label,
    distributionWeight: fields.trust_distribution_weight ?? def.distributionWeight,
    utilities: def.utilities,
    meetsTrusted: Boolean(fields.trust_meets_trusted_requirements),
    identityVerified: Boolean(fields.trust_identity_verified),
    forYouEligible: Boolean(fields.trust_for_you_eligible),
    risingEligible: key !== "observer",
    leaderboardFeatured: Boolean(fields.trust_leaderboard_featured),
    trustedProgress: {
      resolvedCalls: { current: 0, required: TRUSTED_REQUIREMENTS.resolved_calls },
      credibility: { current: 0, required: TRUSTED_REQUIREMENTS.credibility },
      accountAgeDays: { current: 0, required: TRUSTED_REQUIREMENTS.account_age_days },
      abuseFlags: { current: 0, required: TRUSTED_REQUIREMENTS.abuse_flags_max },
    },
  };
}

export async function fetchTrustConfig(): Promise<{
  tagline: string;
  philosophy: string[];
  trusted_requirements: TrustedRequirements & { abuse_flags_max: number };
  tiers: { key: string; label: string; distribution_weight: number; utilities: string[] }[];
} | null> {
  const res = await apiFetch("/trust/config", {}, false);
  if (!res.ok) return null;
  return res.json();
}

export const TRUSTED_UNLOCKS = TRUST_TIERS.find((t) => t.key === "trusted")!.utilities;

export const RANK_ORDER = TRUST_TIERS.filter((t) => t.key !== "verified").map((t) => ({
  key: t.key as TrustTierKey,
  label: t.label,
}));
