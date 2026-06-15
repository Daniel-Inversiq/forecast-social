import type { EnrichedActivePosition } from "@/components/positions/types";
import { relativeResolveLabel } from "@/lib/personalBrief";

export type PersonalStakeCardKind =
  | "resolving_soon"
  | "under_pressure"
  | "high_conviction";

export type PersonalStakeCard = {
  positionId: number;
  slug: string;
  marketTitle: string;
  kind: PersonalStakeCardKind;
  icon: string;
  kindLabel: string;
  primaryLine: string;
  secondaryLines: string[];
  openLoops: string[];
  href: string;
  priority: number;
};

const MAX_CARDS = 3;

function marketHeatScore(p: EnrichedActivePosition): number {
  const hotStates = ["panic repricing", "fragmenting", "volatility spike", "institutional split"];
  return hotStates.includes(p.narrative_state) ? 18 : 6;
}

function resolveUrgencyScore(p: EnrichedActivePosition): number {
  const hours = p.resolution_horizon?.hours_remaining;
  if (hours == null || hours > 14 * 24) return 0;
  if (p.resolution_horizon?.bucket === "tonight") return 120;
  if (hours <= 6) return 110;
  if (hours < 24) return 95;
  if (hours < 72) return 70;
  if (p.resolution_horizon?.bucket === "soon") return 55;
  return 30;
}

function exposureScore(p: EnrichedActivePosition): number {
  return Math.min(80, p.amount / 8 + (p.chips.includes("HIGH CONVICTION") ? 12 : 0));
}

function consensusMoveScore(p: EnrichedActivePosition): number {
  return Math.min(50, Math.abs(p.consensus_drift) * 3);
}

function challengeScore(p: EnrichedActivePosition): number {
  let score = 0;
  if (p.contested) score += 35;
  if (p.chips.includes("UNDER PRESSURE")) score += 22;
  if (p.pressure_score >= 60) score += Math.round(p.pressure_score / 4);
  if (p.chips.includes("FRAGMENTING")) score += 14;
  return score;
}

export function stakePriorityScore(p: EnrichedActivePosition): number {
  return (
    resolveUrgencyScore(p) +
    exposureScore(p) +
    consensusMoveScore(p) +
    challengeScore(p) +
    marketHeatScore(p)
  );
}

function consensusAgainst(p: EnrichedActivePosition): boolean {
  return (
    (p.side === "YES" && p.consensus_drift < -2) ||
    (p.side === "NO" && p.consensus_drift > 2) ||
    p.network_direction === "away"
  );
}

function consensusToward(p: EnrichedActivePosition): boolean {
  return (
    (p.side === "YES" && p.consensus_drift > 2) ||
    (p.side === "NO" && p.consensus_drift < -2) ||
    p.network_direction === "toward"
  );
}

export function stakeDeltaSinceEntry(p: EnrichedActivePosition): string {
  const favorable =
    (p.side === "YES" && p.movement_since_entry > 0) ||
    (p.side === "NO" && p.movement_since_entry < 0);
  const magnitude = Math.max(
    0.08,
    Math.abs(p.amount * (p.consensus_drift || p.movement_since_entry)) * 0.006,
  );
  const sign = favorable ? "+" : "−";
  return `${sign}€${magnitude.toFixed(2)} since entry`;
}

function formatResolvesIn(p: EnrichedActivePosition): string {
  const rh = p.resolution_horizon;
  if (!rh) {
    const label = relativeResolveLabel(p.expected_resolution_at ?? null);
    return label === "soon" ? "Resolution approaching" : `Resolves ${label}`;
  }
  const hours = rh.hours_remaining;
  if (rh.bucket === "tonight" || hours < 12) return "Resolution tonight";
  if (hours <= 6) return "Resolves in 6h";
  if (hours < 24) return "Resolves tonight";
  if (hours < 48) return `Resolves in ${Math.max(1, Math.round(hours))}h`;
  if (rh.bucket === "soon") {
    const days = Math.max(1, Math.round(hours / 24));
    return days === 1 ? "Resolution expected tomorrow" : `Resolves in ${days}d`;
  }
  return rh.label.replace(/^[^\s]+\s/, "") || `Resolves ${rh.short_label.toLowerCase()}`;
}

function consensusShiftLine(p: EnrichedActivePosition, toward: boolean): string {
  const delta = Math.abs(p.consensus_drift);
  if (delta < 1) return toward ? "Consensus aligning with your call." : "Consensus drifting against you.";
  const sign = p.consensus_drift > 0 ? "+" : "";
  if (toward) {
    return `Consensus moved ${sign}${delta}pt toward your position.`;
  }
  return "Consensus moved against you.";
}

export function buildOpenLoopSignals(p: EnrichedActivePosition): string[] {
  const signals: string[] = [];

  if (p.resolution_horizon?.open_loop) {
    signals.push(p.resolution_horizon.open_loop);
  } else if (p.resolution_horizon?.bucket === "tonight") {
    signals.push("Resolution tonight");
  }

  if (p.contested || p.chips.includes("UNDER PRESSURE")) {
    signals.push("Challenge gaining support");
  }

  if (p.chips.includes("FRAGMENTING") || p.narrative_state === "fragmenting") {
    signals.push("Consensus fracturing");
  }

  if (p.chips.includes("ISOLATED") || p.isolation_line) {
    signals.push("Your position is isolated");
  }

  if (p.narrative_state === "volatility spike" || p.narrative_state === "panic repricing") {
    signals.push("Unusual volatility");
  }

  if (p.opposing_agents.length >= 2 && !signals.some((s) => /challenge/i.test(s))) {
    signals.push("Rivalry heating up");
  }

  return [...new Set(signals)].slice(0, 2);
}

function assignCardKind(p: EnrichedActivePosition): PersonalStakeCardKind {
  const resolveStrong = resolveUrgencyScore(p) >= 55;
  const pressureStrong =
    challengeScore(p) >= 40 || consensusAgainst(p) || p.chips.includes("UNDER PRESSURE");
  const convictionStrong = exposureScore(p) >= 35 || p.chips.includes("HIGH CONVICTION");

  if (resolveStrong && resolveUrgencyScore(p) >= challengeScore(p)) {
    return "resolving_soon";
  }
  if (pressureStrong && (consensusAgainst(p) || p.contested)) {
    return "under_pressure";
  }
  if (convictionStrong) return "high_conviction";
  if (resolveStrong) return "resolving_soon";
  if (pressureStrong) return "under_pressure";
  return "high_conviction";
}

const KIND_META: Record<
  PersonalStakeCardKind,
  { icon: string; kindLabel: string }
> = {
  resolving_soon: { icon: "⚡", kindLabel: "Resolving soon" },
  under_pressure: { icon: "⚠", kindLabel: "Position under pressure" },
  high_conviction: { icon: "🔮", kindLabel: "High conviction" },
};

function buildCardLines(
  p: EnrichedActivePosition,
  kind: PersonalStakeCardKind,
): { primaryLine: string; secondaryLines: string[] } {
  switch (kind) {
    case "resolving_soon":
      return {
        primaryLine: stakeDeltaSinceEntry(p),
        secondaryLines: [
          formatResolvesIn(p),
          consensusToward(p)
            ? consensusShiftLine(p, true)
            : consensusShiftLine(p, consensusAgainst(p) ? false : true),
        ],
      };
    case "under_pressure":
      return {
        primaryLine: consensusShiftLine(p, false),
        secondaryLines: [
          p.contested ? "Most challenged position." : "Network pushback intensifying.",
          formatResolvesIn(p),
        ],
      };
    case "high_conviction":
      return {
        primaryLine: "Largest active exposure.",
        secondaryLines: [
          p.contested || p.opposing_agent
            ? `${p.opposing_agent} challenged your thesis.`
            : `${p.conviction_strength}% conviction on record.`,
          consensusToward(p)
            ? consensusShiftLine(p, true)
            : p.chips[0]
              ? p.chips[0].toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
              : "Thesis still open.",
        ],
      };
  }
}

export function buildPersonalStakeCards(
  positions: EnrichedActivePosition[],
): PersonalStakeCard[] {
  if (!positions.length) return [];

  const ranked = [...positions]
    .map((p) => ({ p, priority: stakePriorityScore(p) }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_CARDS);

  return ranked.map(({ p, priority }) => {
    const kind = assignCardKind(p);
    const meta = KIND_META[kind];
    const { primaryLine, secondaryLines } = buildCardLines(p, kind);
    return {
      positionId: p.id,
      slug: p.slug,
      marketTitle: p.market_title,
      kind,
      icon: meta.icon,
      kindLabel: meta.kindLabel,
      primaryLine,
      secondaryLines: secondaryLines.filter(Boolean).slice(0, 2),
      openLoops: buildOpenLoopSignals(p),
      href: `/markets/${p.slug}`,
      priority,
    };
  });
}
