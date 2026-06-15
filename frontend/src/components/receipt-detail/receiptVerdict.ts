import type { ReceiptDetail, ReceiptParticipant } from "./types";

export type ReceiptVerdictKey =
  | "correct"
  | "missed"
  | "consensus_break"
  | "contrarian_win"
  | "consensus_win";

export type ReceiptVerdict = {
  key: ReceiptVerdictKey;
  label: string;
  icon: string;
  toneClass: string;
  borderClass: string;
  glowClass: string;
};

export function forecasterFirstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

export function credibilityImpactLabel(delta: number): string {
  if (delta === 0) return "No change";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta} Credibility`;
}

export function deriveReceiptVerdict(detail: ReceiptDetail): ReceiptVerdict {
  if (detail.outcome === "pending") {
    return {
      key: "correct",
      label: "Pending",
      icon: "◷",
      toneClass: "text-amber-300/95",
      borderClass: "border-amber-500/30",
      glowClass: "from-amber-950/40",
    };
  }

  if (detail.outcome === "missed") {
    return {
      key: "missed",
      label: "Missed",
      icon: "✕",
      toneClass: "text-rose-300/95",
      borderClass: "border-rose-500/35",
      glowClass: "from-rose-950/45",
    };
  }

  const titleLower = detail.forecastTitle.toLowerCase();
  const idLower = detail.id.toLowerCase();
  if (
    idLower.includes("consensus-break") ||
    titleLower.includes("consensus break")
  ) {
    return {
      key: "consensus_break",
      label: "Consensus Break",
      icon: "✓",
      toneClass: "text-violet-300/95",
      borderClass: "border-violet-500/35",
      glowClass: "from-violet-950/50",
    };
  }

  const contrarian =
    detail.side === "YES"
      ? detail.consensusAtCall < 45
      : detail.consensusAtCall > 55;

  if (contrarian) {
    return {
      key: "contrarian_win",
      label: "Contrarian Win",
      icon: "✓",
      toneClass: "text-emerald-300/95",
      borderClass: "border-emerald-500/35",
      glowClass: "from-emerald-950/45",
    };
  }

  const withConsensus =
    detail.side === "YES"
      ? detail.consensusAtCall >= 55
      : detail.consensusAtCall <= 45;

  if (withConsensus) {
    return {
      key: "consensus_win",
      label: "Consensus Win",
      icon: "✓",
      toneClass: "text-sky-300/95",
      borderClass: "border-sky-500/30",
      glowClass: "from-sky-950/40",
    };
  }

  return {
    key: "correct",
    label: "Correct",
    icon: "✓",
    toneClass: "text-emerald-300/95",
    borderClass: "border-emerald-500/35",
    glowClass: "from-emerald-950/45",
  };
}

export type CredibilityDistributionEntry = {
  name: string;
  delta: number;
};

export function buildCredibilityDistribution(detail: ReceiptDetail): {
  winners: CredibilityDistributionEntry[];
  losers: CredibilityDistributionEntry[];
} {
  const winners: CredibilityDistributionEntry[] = [];
  const losers: CredibilityDistributionEntry[] = [];

  const push = (name: string, delta: number) => {
    if (delta > 0) winners.push({ name, delta });
    else if (delta < 0) losers.push({ name, delta });
  };

  push(forecasterFirstName(detail.forecaster.name), detail.credibilityDelta);

  for (const p of [...detail.backers, ...detail.challengers]) {
    push(p.name, p.credibilityDelta);
  }

  winners.sort((a, b) => b.delta - a.delta);
  losers.sort((a, b) => a.delta - b.delta);

  return { winners, losers };
}

export function participantCounts(detail: ReceiptDetail): {
  backers: number;
  challengers: number;
} {
  const net = detail.networkImpact;
  return {
    backers: Math.max(net.backers, detail.backers.length),
    challengers: Math.max(net.challengers, detail.challengers.length),
  };
}

export function filterRelatedByForecaster(detail: ReceiptDetail) {
  return detail.related.filter(
    (r) =>
      r.forecasterName === detail.forecaster.name ||
      r.forecasterName === forecasterFirstName(detail.forecaster.name),
  );
}

export function outcomeLabelForRelated(outcome: ReceiptDetail["outcome"]): string {
  if (outcome === "correct") return "Correct";
  if (outcome === "missed") return "Missed";
  return "Pending";
}
