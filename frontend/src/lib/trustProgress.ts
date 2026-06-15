/**
 * Trust progression model — requirements, summaries, and unlock copy for TrustProgressWidget.
 */

import type { EnrichedAgentProfile } from "@/components/agents/profile/types";
import type { EnrichedUserProfile } from "@/components/users/profile/types";
import { getResolvedReceipts } from "@/components/users/profile/reputation/receiptData";
import type { ScryReceipt } from "@/components/users/profile/reputation/types";
import { resolveCurrentCredibility } from "@/lib/credibility";
import {
  DISTRIBUTION_TAGLINE,
  ELITE_THRESHOLDS,
  EMERGING_RESOLVED_MIN,
  RANKED_THRESHOLDS,
  RANK_ORDER,
  TRUSTED_REQUIREMENTS,
  TRUST_TIERS,
  accountAgeDaysFromIso,
  resolveTrustTier,
  type TrustInputs,
  type TrustTierKey,
} from "@/lib/trust";

export type TrustRequirementId =
  | "resolvedCalls"
  | "credibility"
  | "accountAge"
  | "abuseFlags"
  | "calibration"
  | "reputation";

export type TrustRequirementRow = {
  id: TrustRequirementId;
  label: string;
  current: number;
  required: number;
  suffix?: string;
  met: boolean;
  /** For abuse flags: display as current / max allowed */
  invertProgress?: boolean;
};

export type TrustProgressData = {
  currentTier: TrustTierKey;
  currentLabel: string;
  nextTier: TrustTierKey | null;
  nextLabel: string | null;
  summary: string;
  pathHint: string;
  requirements: TrustRequirementRow[];
  unlocks: string[];
  isObserver: boolean;
  isMaxPerformanceTier: boolean;
  identityVerified: boolean;
  distributionTagline: string;
};

export const TRUSTED_UNLOCK_COPY = [
  "More feed distribution",
  "Ability to start narratives",
  "Higher visibility in Public Reads",
  "Eligibility for Ranked Battles",
] as const;

const PERFORMANCE_LADDER: { key: TrustTierKey; label: string }[] = [
  ...RANK_ORDER,
  { key: "verified", label: "Verified" },
];

function nextPerformanceTier(current: TrustTierKey): TrustTierKey | null {
  const idx = RANK_ORDER.findIndex((t) => t.key === current);
  if (idx < 0 || idx >= RANK_ORDER.length - 1) return null;
  return RANK_ORDER[idx + 1].key;
}

function unlocksForTier(tier: TrustTierKey): string[] {
  if (tier === "trusted") return [...TRUSTED_UNLOCK_COPY];
  const def = TRUST_TIERS.find((t) => t.key === tier);
  if (!def) return [];
  return def.utilities.map((u) => {
    if (u.includes("For You")) return "Eligible for For You feed";
    if (u.includes("leaderboards")) return "Featured in leaderboards";
    if (u.includes("Priority feed")) return "Priority feed distribution";
    if (u.includes("Rising")) return "Appears in Rising section";
    if (u.includes("narratives")) return "Can start narratives";
    return u;
  });
}

function row(
  id: TrustRequirementId,
  label: string,
  current: number,
  required: number,
  opts?: { suffix?: string; invertProgress?: boolean },
): TrustRequirementRow {
  const met = opts?.invertProgress
    ? current <= required
    : current >= required;
  return {
    id,
    label,
    current,
    required,
    suffix: opts?.suffix,
    met,
    invertProgress: opts?.invertProgress,
  };
}

function requirementsForNext(
  current: TrustTierKey,
  input: TrustInputs,
): TrustRequirementRow[] {
  const calibration = input.calibrationScore ?? 50;
  const reputation = input.reputationScore ?? input.credibility;
  const abuse = input.abuseFlags ?? 0;

  switch (current) {
    case "observer":
      return [
        row("resolvedCalls", "Resolved calls", input.resolvedCalls, EMERGING_RESOLVED_MIN),
      ];
    case "emerging":
      return [
        row(
          "resolvedCalls",
          "Resolved calls",
          input.resolvedCalls,
          TRUSTED_REQUIREMENTS.resolved_calls,
        ),
        row(
          "credibility",
          "Credibility",
          Math.round(input.credibility),
          TRUSTED_REQUIREMENTS.credibility,
        ),
        row(
          "accountAge",
          "Account age",
          input.accountAgeDays,
          TRUSTED_REQUIREMENTS.account_age_days,
          { suffix: " days" },
        ),
        row("abuseFlags", "Abuse flags", abuse, TRUSTED_REQUIREMENTS.abuse_flags_max, {
          invertProgress: true,
        }),
      ];
    case "trusted":
      return [
        row(
          "resolvedCalls",
          "Resolved calls",
          input.resolvedCalls,
          RANKED_THRESHOLDS.resolvedCalls,
        ),
        row(
          "credibility",
          "Credibility",
          Math.round(input.credibility),
          RANKED_THRESHOLDS.credibility,
        ),
        row(
          "calibration",
          "Calibration",
          Math.round(calibration),
          RANKED_THRESHOLDS.calibrationMin,
          { suffix: "%" },
        ),
      ];
    case "ranked":
      return [
        row(
          "resolvedCalls",
          "Resolved calls",
          input.resolvedCalls,
          ELITE_THRESHOLDS.resolvedCalls,
        ),
        row(
          "credibility",
          "Credibility",
          Math.round(input.credibility),
          ELITE_THRESHOLDS.credibility,
        ),
        row(
          "reputation",
          "Reputation score",
          Math.round(reputation),
          ELITE_THRESHOLDS.reputationMin,
        ),
        row(
          "calibration",
          "Calibration",
          Math.round(calibration),
          ELITE_THRESHOLDS.calibrationMin,
          { suffix: "%" },
        ),
      ];
    default:
      return [];
  }
}

function buildSummary(
  data: Pick<
    TrustProgressData,
    "currentTier" | "nextLabel" | "isObserver" | "isMaxPerformanceTier" | "requirements"
  >,
): string {
  if (data.isObserver) {
    return "Make your first public read to begin building reputation.";
  }
  if (data.isMaxPerformanceTier || !data.nextLabel) {
    return "Top forecasting tier unlocked — defend your record to hold distribution.";
  }

  const unmet = data.requirements.filter((r) => !r.met);
  if (unmet.length === 0) {
    return `Almost ${data.nextLabel} — one strong receipt could unlock more distribution.`;
  }

  const onlyAge =
    unmet.length === 1 && unmet[0].id === "accountAge";
  if (onlyAge) {
    const days = Math.max(1, unmet[0].required - unmet[0].current);
    return `Only ${days} more day${days === 1 ? "" : "s"} until account age requirement is met.`;
  }

  const resolved = unmet.find((r) => r.id === "resolvedCalls");
  const cred = unmet.find((r) => r.id === "credibility");
  const resolvedGap = resolved ? Math.max(0, resolved.required - resolved.current) : 0;
  const credGap = cred ? Math.max(0, cred.required - cred.current) : 0;

  if (resolvedGap > 0 && credGap > 0) {
    return `${resolvedGap} more resolved call${resolvedGap === 1 ? "" : "s"} and +${credGap} credibility needed to unlock ${data.nextLabel}.`;
  }
  if (resolvedGap > 0) {
    return `${resolvedGap} more resolved call${resolvedGap === 1 ? "" : "s"} needed to unlock ${data.nextLabel}.`;
  }
  if (credGap > 0) {
    return `+${credGap} credibility needed to unlock ${data.nextLabel}.`;
  }

  const first = unmet[0];
  const gap = Math.max(0, first.required - first.current);
  return `${gap} more toward ${first.label.toLowerCase()} to unlock ${data.nextLabel}.`;
}

function pathHintForTier(current: TrustTierKey): string {
  if (current === "observer" || current === "emerging") {
    return "Fastest path: publish resolved, high-conviction calls.";
  }
  if (current === "trusted" || current === "ranked") {
    return "Posting more does not increase trust. Being right on record does.";
  }
  return "Distribution unlocked through trust.";
}

export function buildTrustProgressData(input: TrustInputs): TrustProgressData {
  const trust = resolveTrustTier(input);
  const current = trust.tierKey;
  const next = nextPerformanceTier(current);
  const isMaxPerformanceTier = current === "elite";
  const isObserver = current === "observer";

  const requirements = next ? requirementsForNext(current, input) : [];
  const nextDef = next ? TRUST_TIERS.find((t) => t.key === next) : null;

  const data: TrustProgressData = {
    currentTier: current,
    currentLabel: trust.tierLabel,
    nextTier: next,
    nextLabel: nextDef?.label ?? null,
    summary: "",
    pathHint: pathHintForTier(current),
    requirements,
    unlocks: next ? unlocksForTier(next) : [],
    isObserver,
    isMaxPerformanceTier,
    identityVerified: trust.identityVerified,
    distributionTagline: DISTRIBUTION_TAGLINE,
  };

  data.summary = buildSummary(data);
  return data;
}

export function buildUserTrustProgress(
  profile: EnrichedUserProfile,
  receipts: ScryReceipt[],
): TrustProgressData {
  const resolved = getResolvedReceipts(receipts);
  const resolvedCount = Math.max(resolved.length, profile.resolved_calls ?? 0);
  const credibility = resolveCurrentCredibility(receipts, profile.reputation_score);

  return buildTrustProgressData({
    resolvedCalls: resolvedCount,
    credibility,
    accountAgeDays: accountAgeDaysFromIso(profile.member_since),
    abuseFlags: 0,
    calibrationScore: profile.reputation?.calibration_score ?? profile.accuracy_score,
    reputationScore: credibility,
    identityVerified: profile.wallet_verified,
  });
}

export function buildAgentTrustProgress(
  profile: EnrichedAgentProfile,
  receipts?: ScryReceipt[],
): TrustProgressData {
  const resolved = receipts ? getResolvedReceipts(receipts).length : profile.resolved_calls;
  const credibility = receipts
    ? resolveCurrentCredibility(receipts, profile.reputation_score)
    : profile.reputation_score;
  const ageDays = 90 + (profile.slug.length % 120);

  return buildTrustProgressData({
    resolvedCalls: Math.max(resolved, profile.resolved_calls),
    credibility,
    accountAgeDays: ageDays,
    abuseFlags: 0,
    calibrationScore: profile.reputation?.calibration_score ?? profile.accuracy_score,
    reputationScore: credibility,
    identityVerified: profile.is_verified,
  });
}

/** Demo state for reputation page and offline previews */
export function buildDemoTrustProgress(): TrustProgressData {
  return buildTrustProgressData({
    resolvedCalls: 6,
    credibility: 50,
    accountAgeDays: 9,
    abuseFlags: 0,
    calibrationScore: 58,
    reputationScore: 50,
    identityVerified: false,
  });
}

export { PERFORMANCE_LADDER as TRUST_PROGRESS_LADDER };
