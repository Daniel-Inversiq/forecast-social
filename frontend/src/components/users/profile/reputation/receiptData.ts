import type { EnrichedUserProfile } from "@/components/users/profile/types";
import type { PositionsPayload } from "@/components/positions/types";
import {
  estimateReceiptCredibilityDelta,
  getCredibilityLedgerEntries,
  getResolvedReceipts,
  sumCredibilityFromReceipts,
  sumReceiptCredibilityDeltas,
} from "@/lib/credibility";
import { DEMO_SCRY_RECEIPTS } from "./mockReceipts";
import type { ScryReceipt, ScryReceiptOutcome } from "./types";

export {
  getCredibilityLedgerEntries,
  getResolvedReceipts,
  sumCredibilityFromReceipts,
  sumReceiptCredibilityDeltas,
};

function hash(s: string) {
  return s.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

function positionsToScryReceipts(positions: PositionsPayload): ScryReceipt[] {
  return positions.resolved_positions.slice(0, 10).map((p) => ({
    id: `receipt-position-${p.id}`,
    forecastTitle: p.market_title,
    calledProbability: Math.round(p.probability_at_entry),
    consensusAtCall: Math.max(
      12,
      Math.min(88, Math.round(p.probability_at_entry - 18 + (hash(p.market_title) % 24))),
    ),
    side: p.side === "NO" ? "NO" : "YES",
    calledAt: p.created_at.slice(0, 10),
    resolvedAt: p.created_at.slice(0, 10),
    outcome: (p.result === "correct" ? "correct" : "missed") as ScryReceiptOutcome,
    credibilityDelta: estimateReceiptCredibilityDelta({
      correct: p.result === "correct",
      seed: p.market_title,
    }),
    reasoningExcerpt: `On-record ${p.side} conviction before resolution.`,
    receiptStatus: "verified" as const,
  }));
}

/** Resolved + pending receipts for profile proof surfaces. */
export function getProfileScryReceipts(
  profile: EnrichedUserProfile,
  positions: PositionsPayload | null,
): ScryReceipt[] {
  const fromPositions = positions?.resolved_positions.length
    ? positionsToScryReceipts(positions)
    : [];

  if (fromPositions.length >= 5) {
    return fromPositions;
  }

  const h = hash(profile.slug);
  const slice = 5 + (h % 4);
  return DEMO_SCRY_RECEIPTS.slice(0, slice);
}
