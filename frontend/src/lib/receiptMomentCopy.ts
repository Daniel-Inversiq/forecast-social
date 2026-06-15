import type { EnrichedVerifiedCall } from "@/components/verified-calls/types";

function consensusAgainstPct(call: EnrichedVerifiedCall): number {
  if (call.side === "YES") {
    return Math.round(100 - call.consensus_at_time);
  }
  return Math.round(call.consensus_at_time);
}

export function receiptTimingLine(daysEarly: number): string {
  if (daysEarly >= 1) {
    return `Called ${daysEarly}d early.`;
  }
  return "Stamped before repricing.";
}

export function receiptConsensusLine(call: EnrichedVerifiedCall): string | null {
  const against = consensusAgainstPct(call);
  if (against >= 55) {
    return `Consensus was ${against}% against this.`;
  }
  if (call.consensus_breaking) {
    return "Public read verified.";
  }
  return null;
}

export function receiptHeadline(call: EnrichedVerifiedCall): string {
  if (call.receipt_strength === "legendary" || call.days_early >= 14) {
    return "CALLED IT";
  }
  if (call.is_verified) {
    return "RECEIPT VERIFIED";
  }
  return "RECEIPT ARCHIVED";
}

export function receiptSubline(call: EnrichedVerifiedCall): string {
  const lines = [receiptTimingLine(call.days_early)];
  const consensus = receiptConsensusLine(call);
  if (consensus) lines.push(consensus);
  if (call.is_verified) lines.push("Receipt locked.");
  return lines.join(" ");
}

export function receiptNotificationCopy(
  marketTitle: string,
  side?: string,
): { title: string; body: string } {
  const short = marketTitle.length > 48 ? `${marketTitle.slice(0, 45)}…` : marketTitle;
  const sideBit = side ? ` ${side}` : "";
  return {
    title: `Receipt verified: your${sideBit} call on ${short} resolved in your favor.`,
    body: "Public read verified. Receipt locked.",
  };
}

export function receiptSharePlaceholderNote(): string {
  return "Screenshot this card to share — image export coming soon.";
}
