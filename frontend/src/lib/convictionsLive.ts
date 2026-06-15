import type { EnrichedActivePosition } from "@/components/positions/types";
import { stakeDeltaSinceEntry, stakePriorityScore } from "@/lib/personalStake";
import { titleToSlug } from "@/lib/slugs";

export type ConvictionLiveRow = {
  positionId: number;
  marketTitle: string;
  slug: string;
  backedAgent: string | null;
  consensusPct: number;
  pnlLabel: string;
  resolveLabel: string;
  hoursRemaining: number | null;
  href: string;
};

/** Dev-only sample when NEXT_PUBLIC_DEMO_CONVICTIONS=1 */
export const DEMO_CONVICTION_ROWS: ConvictionLiveRow[] = [
  {
    positionId: 9001,
    marketTitle: "Fed Cut by Sep 2026",
    slug: "fed-cut-by-sep-2026",
    backedAgent: "Macro Oracle",
    consensusPct: 69,
    pnlLabel: "+€1.20",
    resolveLabel: "resolves in 5h 40m",
    hoursRemaining: 5.67,
    href: "/me/positions",
  },
  {
    positionId: 9002,
    marketTitle: "BTC above 150k",
    slug: "btc-above-150k",
    backedAgent: "ChaosQuant",
    consensusPct: 42,
    pnlLabel: "−€0.40",
    resolveLabel: "resolves in 2d",
    hoursRemaining: 48,
    href: "/me/positions",
  },
];

export function formatConvictionPnl(p: EnrichedActivePosition): string {
  const raw = stakeDeltaSinceEntry(p);
  const match = raw.match(/[+\u2212-]€[\d.]+/);
  if (match) return match[0].replace("\u2212", "−");
  const favorable =
    (p.side === "YES" && p.movement_since_entry > 0) ||
    (p.side === "NO" && p.movement_since_entry < 0);
  const magnitude = Math.max(0.08, Math.abs(p.amount * 0.006));
  return `${favorable ? "+" : "−"}€${magnitude.toFixed(2)}`;
}

export function formatConvictionResolve(p: EnrichedActivePosition): string {
  const hours = p.resolution_horizon?.hours_remaining;
  if (hours != null && hours > 0) {
    if (hours < 24) {
      const hrs = Math.floor(hours);
      const mins = Math.round((hours - hrs) * 60);
      if (mins > 0) return `resolves in ${hrs}h ${mins}m`;
      return `resolves in ${hrs}h`;
    }
    const days = Math.max(1, Math.round(hours / 24));
    return `resolves in ${days}d`;
  }
  if (p.expected_resolution_at) {
    const ms = Date.parse(p.expected_resolution_at);
    if (Number.isFinite(ms)) {
      const h = (ms - Date.now()) / (60 * 60 * 1000);
      if (h > 0 && h < 24) return `resolves in ${Math.round(h)}h`;
      if (h >= 24) return `resolves in ${Math.max(1, Math.round(h / 24))}d`;
    }
  }
  return "awaiting verdict";
}

function hoursRemainingFor(p: EnrichedActivePosition): number | null {
  const h = p.resolution_horizon?.hours_remaining;
  if (h != null && h > 0) return h;
  if (p.expected_resolution_at) {
    const ms = Date.parse(p.expected_resolution_at);
    if (Number.isFinite(ms)) {
      const remaining = (ms - Date.now()) / (60 * 60 * 1000);
      return remaining > 0 ? remaining : null;
    }
  }
  return null;
}

export function backedAgentLabel(p: EnrichedActivePosition): string | null {
  const name = p.supporting_agents[0] ?? null;
  return name;
}

export function enrichConvictionRow(p: EnrichedActivePosition): ConvictionLiveRow {
  return {
    positionId: p.id,
    marketTitle: p.market_title,
    slug: p.slug ?? titleToSlug(p.market_title),
    backedAgent: backedAgentLabel(p),
    consensusPct: p.consensus_current,
    pnlLabel: formatConvictionPnl(p),
    resolveLabel: formatConvictionResolve(p),
    hoursRemaining: hoursRemainingFor(p),
    href: `/markets/${p.slug ?? titleToSlug(p.market_title)}`,
  };
}

export function buildConvictionLiveRows(positions: EnrichedActivePosition[]): ConvictionLiveRow[] {
  return [...positions]
    .sort((a, b) => stakePriorityScore(b) - stakePriorityScore(a))
    .map(enrichConvictionRow);
}

export function nextResolutionLabel(rows: ConvictionLiveRow[]): string | null {
  const withHours = rows.filter((r) => r.hoursRemaining != null);
  if (!withHours.length) return null;
  const soonest = withHours.reduce((a, b) =>
    (a.hoursRemaining ?? Infinity) < (b.hoursRemaining ?? Infinity) ? a : b,
  );
  return soonest.resolveLabel.replace(/^resolves /i, "");
}

export function useDemoConvictions(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_DEMO_CONVICTIONS === "1"
  );
}
