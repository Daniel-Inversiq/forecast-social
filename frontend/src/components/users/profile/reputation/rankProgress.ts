import type { EnrichedUserProfile } from "@/components/users/profile/types";
import {
  RANK_ORDER,
  TRUSTED_UNLOCKS,
  TRUST_TIERS,
  accountAgeDaysFromIso,
  resolveTrustTier,
  type TrustTierKey,
} from "@/lib/trust";
import { getResolvedReceipts } from "./receiptData";
import { resolveCurrentCredibility } from "@/lib/credibility";
import type { ScryReceipt } from "./types";
import type { ForecastingRankKey, ForecastingRankProgress } from "./types";

export type { ForecastingRankKey, ForecastingRankProgress };

function nextTierUtilities(tierKey: TrustTierKey): string[] {
  const idx = RANK_ORDER.findIndex((r) => r.key === tierKey);
  if (idx < 0 || idx >= RANK_ORDER.length - 1) return [];
  const next = RANK_ORDER[idx + 1];
  if (next.key === "trusted") return TRUSTED_UNLOCKS;
  return TRUST_TIERS.find((t) => t.key === next.key)?.utilities ?? [];
}

export function buildRankProgress(
  profile: EnrichedUserProfile,
  receipts: ScryReceipt[],
): ForecastingRankProgress {
  const resolved = getResolvedReceipts(receipts);
  const resolvedCount = resolved.length || profile.resolved_calls || 0;
  const credibility = resolveCurrentCredibility(receipts, profile.reputation_score);
  const ageDays = accountAgeDaysFromIso(profile.member_since);
  const calibrationTrendPositive =
    (profile.reputation?.calibration_score ?? profile.accuracy_score) >= 62;

  const trust = resolveTrustTier({
    resolvedCalls: resolvedCount,
    credibility,
    accountAgeDays: ageDays,
    abuseFlags: 0,
    calibrationScore: profile.reputation?.calibration_score ?? profile.accuracy_score,
    reputationScore: profile.reputation_score,
    identityVerified: profile.wallet_verified,
  });

  const currentRank = trust.tierKey as ForecastingRankKey;
  const idx = RANK_ORDER.findIndex((r) => r.key === currentRank);
  const next = idx >= 0 && idx < RANK_ORDER.length - 1 ? RANK_ORDER[idx + 1] : null;
  const progress = trust.trustedProgress;

  return {
    currentRank,
    currentLabel: trust.tierLabel,
    nextRank: (next?.key as ForecastingRankKey) ?? null,
    nextLabel: next?.label ?? null,
    resolvedCalls: {
      current: Math.min(progress.resolvedCalls.current, progress.resolvedCalls.required),
      required: progress.resolvedCalls.required,
    },
    credibility: {
      current: Math.min(Math.max(0, progress.credibility.current), progress.credibility.required + 20),
      required: progress.credibility.required,
    },
    abuseFlags: progress.abuseFlags.current,
    accountAgeDays: {
      current: Math.min(progress.accountAgeDays.current, progress.accountAgeDays.required),
      required: progress.accountAgeDays.required,
    },
    calibrationTrendPositive,
    unlocks: next ? nextTierUtilities(currentRank) : [],
  };
}

export { RANK_ORDER };
