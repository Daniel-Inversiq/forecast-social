import { receiptDetailPath } from "@/lib/receiptIds";
import type { ScryReceipt } from "./types";
import { credibilityLabel } from "./receiptUi";

export type RecentGainItem = {
  id: string;
  delta: number;
  label: string;
  created_at: string;
  href: string;
};

function receiptSortKey(receipt: ScryReceipt): number {
  const iso = receipt.resolvedAt ?? receipt.calledAt;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function gainNarrative(receipt: ScryReceipt): string {
  return receipt.forecastTitle.trim();
}

/** Resolved receipts with credibility movement, newest first. */
export function buildRecentGains(receipts: ScryReceipt[], limit = 8): RecentGainItem[] {
  return receipts
    .filter((r) => r.outcome !== "pending" && r.credibilityDelta !== 0)
    .sort((a, b) => receiptSortKey(b) - receiptSortKey(a))
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      delta: r.credibilityDelta,
      label: gainNarrative(r),
      created_at: r.resolvedAt ?? r.calledAt,
      href: receiptDetailPath(r.id),
    }));
}

export function formatGainLine(delta: number, narrative: string): string {
  const sign = credibilityLabel(delta);
  return `${sign} credibility — ${narrative}`;
}
