/**
 * Single source of truth for SCRY credibility.
 *
 * Current Credibility = sum(all resolved receipt credibility deltas).
 * Lifetime Credibility Earned = sum(positive deltas only) — shown separately when it differs.
 */

import type { ScryReceipt } from "@/components/users/profile/reputation/types";

export type ForecastRecord = {
  correct: number;
  missed: number;
  pending: number;
  resolved: number;
  /** 0–100 when at least one resolved call exists */
  winRate: number | null;
};

export type CredibilitySnapshot = {
  /** Primary score — net sum of receipt deltas */
  current: number;
  /** Secondary — gross positive deltas only */
  lifetimeEarned: number;
  forecastRecord: ForecastRecord;
};

export function getResolvedReceipts(receipts: ScryReceipt[]): ScryReceipt[] {
  return receipts.filter((r) => r.outcome !== "pending");
}

/** Net credibility from all resolved receipts (primary SCRY score). */
export function sumReceiptCredibilityDeltas(receipts: ScryReceipt[]): number {
  return getResolvedReceipts(receipts).reduce((sum, r) => sum + r.credibilityDelta, 0);
}

/** Gross positive credibility from resolved receipts (secondary metric). */
export function sumLifetimeCredibilityEarned(receipts: ScryReceipt[]): number {
  return getResolvedReceipts(receipts).reduce(
    (sum, r) => sum + Math.max(0, r.credibilityDelta),
    0,
  );
}

export function computeForecastRecord(receipts: ScryReceipt[]): ForecastRecord {
  const resolved = getResolvedReceipts(receipts);
  const correct = resolved.filter((r) => r.outcome === "correct").length;
  const missed = resolved.filter((r) => r.outcome === "missed").length;
  const pending = receipts.filter((r) => r.outcome === "pending").length;
  const resolvedCount = correct + missed;
  const winRate =
    resolvedCount > 0 ? Math.round((correct / resolvedCount) * 100) : null;
  return { correct, missed, pending, resolved: resolvedCount, winRate };
}

export function computeCredibilitySnapshot(receipts: ScryReceipt[]): CredibilitySnapshot {
  return {
    current: sumReceiptCredibilityDeltas(receipts),
    lifetimeEarned: sumLifetimeCredibilityEarned(receipts),
    forecastRecord: computeForecastRecord(receipts),
  };
}

/**
 * Resolve displayed current credibility: receipt ledger first, then API score when no receipts.
 */
export function resolveCurrentCredibility(
  receipts: ScryReceipt[],
  apiScore?: number | null,
): number {
  if (getResolvedReceipts(receipts).length > 0) {
    return sumReceiptCredibilityDeltas(receipts);
  }
  if (apiScore != null && Number.isFinite(apiScore)) {
    return Math.round(apiScore);
  }
  return 0;
}

export function getCredibilityLedgerEntries(receipts: ScryReceipt[]) {
  return receipts
    .filter((r) => r.outcome !== "pending" && r.credibilityDelta !== 0)
    .map((r) => ({
      id: r.id,
      delta: r.credibilityDelta,
      label: r.forecastTitle,
    }));
}

/** Derive a receipt delta when only outcome + seed are known (compare battle receipts). */
export function estimateReceiptCredibilityDelta(input: {
  correct: boolean;
  seed: string;
}): number {
  const h = input.seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return input.correct ? 8 + (h % 14) : -(4 + (h % 8));
}

/** @deprecated Use sumReceiptCredibilityDeltas */
export const sumCredibilityFromReceipts = sumReceiptCredibilityDeltas;
