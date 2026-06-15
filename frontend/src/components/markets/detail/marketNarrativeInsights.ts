import { buildMarketChartMarkers } from "./marketChartNarratives";
import { enrichTakeWithReputationFallback } from "./marketDetailCredibility";
import type { EnrichedMarketDetail } from "./types";

export type NarrativeDriver = {
  rank: number;
  name: string;
  slug: string;
  influence: number;
  detail: string;
};

export type MarketMovementSummary = {
  yesProb: number;
  noProb: number;
  drivers: string[];
};

function hash(s: string) {
  return s.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

function driverDetail(
  take: ReturnType<typeof enrichTakeWithReputationFallback>,
  market: EnrichedMarketDetail,
): string {
  const prob = Math.round(market.current_yes_probability);
  const conf = Math.round(take.confidence);

  if (take.side === "YES" && conf >= prob - 4) {
    return `${take.name} entered YES`;
  }
  if (take.side === "NO" && conf > 100 - prob + 6) {
    return `${take.name} thesis alignment`;
  }
  if (Math.abs(conf - prob) >= 12) {
    return `${take.name} thesis alignment`;
  }
  if (take.side === "YES") {
    return `${take.name} conviction increase`;
  }
  return `${take.name} contrarian pressure`;
}

function influenceScore(
  take: ReturnType<typeof enrichTakeWithReputationFallback>,
  market: EnrichedMarketDetail,
): number {
  const rep = take.reputation_score ?? 52;
  const edge = Math.abs(take.confidence - market.current_yes_probability);
  const timing = (take.timing_quality ?? 60) / 100;
  const h = hash(take.slug);
  return Math.round(4 + rep * 0.22 + edge * 0.35 + timing * 6 + (h % 5));
}

export function buildNarrativeDrivers(market: EnrichedMarketDetail): NarrativeDriver[] {
  const scored = market.agent_takes
    .map((t) => enrichTakeWithReputationFallback(t))
    .map((take) => ({
      name: take.name,
      slug: take.slug,
      influence: influenceScore(take, market),
      detail: driverDetail(take, market),
    }))
    .sort((a, b) => b.influence - a.influence)
    .slice(0, 5);

  return scored.map((row, i) => ({ ...row, rank: i + 1 }));
}

export function buildMovementSummary(market: EnrichedMarketDetail): MarketMovementSummary {
  const yesProb = Math.round(market.current_yes_probability);
  const markers = buildMarketChartMarkers(market);
  const drivers: string[] = [];

  for (const m of markers) {
    if (m.headline.includes("OPEC") || m.headline.includes("Fed")) {
      drivers.push(m.headline);
    }
  }

  const topAgents = buildNarrativeDrivers(market).slice(0, 3);
  for (const d of topAgents) {
    if (d.detail.includes("entered YES")) {
      drivers.push(`${d.name} entered YES`);
    } else if (d.detail.includes("thesis alignment")) {
      drivers.push(`${d.name} thesis alignment`);
    } else if (d.detail.includes("conviction increase")) {
      drivers.push(`${d.name} conviction increase`);
    } else if (d.detail.includes("contrarian")) {
      drivers.push(`${d.name} contrarian pressure`);
    }
  }

  if (drivers.length === 0 && market.why_moving.headline) {
    drivers.push(market.why_moving.headline);
  }
  if (drivers.length === 0 && market.why_moved) {
    drivers.push(market.why_moved.slice(0, 64));
  }
  if (drivers.length === 0 && market.narrative) {
    drivers.push(market.narrative.slice(0, 72));
  }

  const unique = [...new Set(drivers)].slice(0, 4);

  return {
    yesProb,
    noProb: 100 - yesProb,
    drivers: unique.length > 0 ? unique : ["Network repricing still accumulating on thread"],
  };
}
