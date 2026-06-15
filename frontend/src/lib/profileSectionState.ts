import type { PositionsPayload } from "@/components/positions/types";
import type { EnrichedUserProfile } from "@/components/users/profile/types";
import type { ScryReceipt } from "@/components/users/profile/reputation/types";
import { buildRecentGains } from "@/components/users/profile/reputation/recentGains";
import { countActivePositions } from "@/lib/activePositions";
import { getResolvedReceipts } from "@/lib/credibility";

export function countResolvedReceipts(receipts: ScryReceipt[]): number {
  return getResolvedReceipts(receipts).length;
}

export function hasRecentCredibilityGains(receipts: ScryReceipt[]): boolean {
  return buildRecentGains(receipts).length > 0;
}

export function hasActivePositions(
  positions: PositionsPayload | null,
  profilePositionCount = 0,
): boolean {
  return countActivePositions(positions, profilePositionCount) > 0;
}

export function hasPositionList(
  positions: PositionsPayload | null,
  profilePositionCount = 0,
): boolean {
  return (
    (positions?.active_positions?.length ?? 0) > 0 || profilePositionCount > 0
  );
}

export function hasResolvedPositionsLedger(positions: PositionsPayload | null): boolean {
  return (positions?.resolved_positions?.length ?? 0) > 0;
}

export function hasEnrichedReceipts(profile: EnrichedUserProfile): boolean {
  return profile.enriched_receipts.length > 0;
}

export function hasVerifiedReceiptsArchive(profile: EnrichedUserProfile): boolean {
  return (profile.verified_receipts?.length ?? 0) > 0;
}

export function hasAnyResolvedReceiptProof(
  receipts: ScryReceipt[],
  profile: EnrichedUserProfile,
  positions: PositionsPayload | null,
): boolean {
  return (
    countResolvedReceipts(receipts) > 0 ||
    hasResolvedPositionsLedger(positions) ||
    hasEnrichedReceipts(profile)
  );
}

export function hasFeedReads(
  feedReads?: EnrichedUserProfile["feed_reads"] | null,
): boolean {
  if (!feedReads) return false;
  return (
    feedReads.back_count > 0 ||
    feedReads.challenge_count > 0 ||
    (feedReads.recent_thread_posts?.length ?? 0) > 0 ||
    feedReads.recent_backs.length > 0 ||
    feedReads.recent_challenges.length > 0
  );
}

export function hasFeedBacks(feedReads?: EnrichedUserProfile["feed_reads"] | null): boolean {
  if (!feedReads) return false;
  return feedReads.back_count > 0 || feedReads.recent_backs.length > 0;
}

export function hasFeedChallenges(feedReads?: EnrichedUserProfile["feed_reads"] | null): boolean {
  if (!feedReads) return false;
  return feedReads.challenge_count > 0 || feedReads.recent_challenges.length > 0;
}

export function hasConvictionOnRecord(
  feedReads?: EnrichedUserProfile["feed_reads"] | null,
): boolean {
  if (!feedReads) return false;
  return feedReads.back_count > 0 || feedReads.challenge_count > 0;
}

export function hasProfileSignals(profile: EnrichedUserProfile): boolean {
  return profile.signals.length > 0;
}

export function hasAlignedAgents(profile: EnrichedUserProfile): boolean {
  return profile.aligned_agents.length > 0;
}

export function hasSidebarPublicForecasts(
  profile: EnrichedUserProfile,
  positions: PositionsPayload | null,
): boolean {
  return hasPositionList(positions, profile.positions.length);
}

export type SidebarForecastRow = {
  key: string;
  market: string;
  thesis: string;
  side: "YES" | "NO";
  conviction: number;
};

export function sidebarPublicForecastRows(
  profile: EnrichedUserProfile,
  positions: PositionsPayload | null,
): SidebarForecastRow[] {
  const fromPayload = positions?.active_positions ?? [];
  if (fromPayload.length > 0) {
    return fromPayload.slice(0, 4).map((p) => ({
      key: `pos-${p.id}`,
      market: p.market_title,
      thesis: "",
      side: p.side,
      conviction: Math.round(p.current_probability),
    }));
  }
  return profile.positions.slice(0, 4).map((pos, i) => ({
    key: `${pos.market}-${i}`,
    market: pos.market,
    thesis: pos.thesis,
    side: pos.side,
    conviction: pos.conviction,
  }));
}
