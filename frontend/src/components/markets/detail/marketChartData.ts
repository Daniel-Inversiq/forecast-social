import type { EnrichedMarketDetail } from "./types";

export type ChartTimeRange = "1D" | "1W" | "1M" | "3M" | "ALL";

export const CHART_TIME_RANGES: ChartTimeRange[] = ["1D", "1W", "1M", "3M", "ALL"];

export const TIME_RANGE_MS: Record<Exclude<ChartTimeRange, "ALL">, number> = {
  "1D": 24 * 60 * 60 * 1000,
  "1W": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
  "3M": 90 * 24 * 60 * 60 * 1000,
};

/** Full synthetic timeline span — 120 days of hourly ticks. */
export const CHART_HISTORY_DAYS = 120;
export const CHART_FULL_SPAN_MS = CHART_HISTORY_DAYS * 24 * 60 * 60 * 1000;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const RANGE_BUCKET_MS: Record<ChartTimeRange, number> = {
  "1D": HOUR_MS,
  "1W": 4 * HOUR_MS,
  "1M": DAY_MS,
  "3M": DAY_MS,
  ALL: DAY_MS,
};

export type ProbHistoryPoint = {
  t: number;
  yes: number;
  no: number;
};

export type AgentPositionMarker = {
  id: string;
  agentName: string;
  agentSlug: string;
  side: "YES" | "NO";
  confidence: number;
  at: string;
  historyIndex: number;
};

export type MarketActivityPoint = {
  volume: number;
  participation: number;
};

function hash(s: string) {
  return s.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

function createRng(seed: string) {
  let h = hash(seed) || 1;
  return () => {
    h = (h * 1103515245 + 12345) | 0;
    return (h >>> 16) / 65536;
  };
}

type VolatilityLevel = EnrichedMarketDetail["volatility"];

/** Deterministic, high-resolution market walk ending at current YES probability. */
export function generateMarketHistory(
  slug: string,
  endYes: number,
  movementDelta: number,
  volatility: VolatilityLevel = "medium",
): ProbHistoryPoint[] {
  const now = Date.now();
  const totalHours = CHART_HISTORY_DAYS * 24;
  const startYes = Math.max(6, Math.min(94, endYes - movementDelta));
  const rng = createRng(slug);
  const volScale =
    volatility === "high" ? 2.4 : volatility === "medium" ? 1.5 : 0.85;

  const spikeHours = new Set<number>();
  const spikeCount = 6 + Math.floor(rng() * 10);
  for (let s = 0; s < spikeCount; s++) {
    spikeHours.add(Math.floor(rng() * totalHours));
  }

  const consolidationWindows = [0.15, 0.35, 0.55, 0.72, 0.88].map((p) => {
    const start = Math.floor(p * totalHours + (rng() - 0.5) * totalHours * 0.04);
    return { start, end: start + 18 + Math.floor(rng() * 12) };
  });

  const points: ProbHistoryPoint[] = [];
  let yes = startYes;

  for (let h = 0; h <= totalHours; h++) {
    const progress = h / totalHours;
    const target = startYes + (endYes - startYes) * Math.pow(progress, 0.92);
    const meanRevert = (target - yes) * 0.065;
    const noise = (rng() - 0.5) * volScale * 1.6;

    let shock = 0;
    if (spikeHours.has(h)) {
      shock = (rng() - 0.42) * (8 + volScale * 4);
    }

    const inConsolidation = consolidationWindows.some(
      (w) => h >= w.start && h <= w.end,
    );
    const drift = inConsolidation ? (target - yes) * 0.02 : 0;

    yes = yes + meanRevert + noise + shock + drift;
    yes = Math.max(4, Math.min(96, yes));

    if (h === totalHours) {
      yes = endYes;
    }

    const rounded = Math.round(yes * 10) / 10;
    points.push({
      t: now - (totalHours - h) * HOUR_MS,
      yes: rounded,
      no: Math.round((100 - rounded) * 10) / 10,
    });
  }

  return points;
}

function downsampleBucket(points: ProbHistoryPoint[], bucketMs: number): ProbHistoryPoint[] {
  if (points.length <= 2) return points;

  const buckets = new Map<number, ProbHistoryPoint>();
  for (const p of points) {
    const key = Math.floor(p.t / bucketMs);
    buckets.set(key, p);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, p]) => p);
}

/** Compact YES values for sparklines and legacy consumers (~daily). */
export function buildProbHistoryValues(
  slug: string,
  endYes: number,
  movementDelta: number,
  volatility: VolatilityLevel = "medium",
): number[] {
  const full = generateMarketHistory(slug, endYes, movementDelta, volatility);
  return downsampleBucket(full, DAY_MS).map((p) => Math.round(p.yes));
}

export function buildProbHistorySeries(market: EnrichedMarketDetail): ProbHistoryPoint[] {
  return generateMarketHistory(
    market.slug,
    market.current_yes_probability,
    market.movement_delta,
    market.volatility,
  );
}

export function sliceHistoryForRange(
  points: ProbHistoryPoint[],
  range: ChartTimeRange,
): ProbHistoryPoint[] {
  if (points.length <= 2) return points;

  const cutoff =
    range === "ALL" ? points[0].t : Date.now() - TIME_RANGE_MS[range];
  const filtered = points.filter((p) => p.t >= cutoff);
  const source = filtered.length >= 2 ? filtered : points.slice(-Math.max(24, points.length));

  return downsampleBucket(source, RANGE_BUCKET_MS[range]);
}

export function timeToSeriesIndex(at: string, points: ProbHistoryPoint[]): number {
  if (points.length === 0) return 0;
  const t = new Date(at).getTime();
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < points.length; i++) {
    const d = Math.abs(points[i].t - t);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** Map a global series index onto a sliced view by timestamp. */
export function mapGlobalIndexToSlice(
  globalIndex: number,
  fullSeries: ProbHistoryPoint[],
  slice: ProbHistoryPoint[],
): number {
  if (slice.length <= 1) return 0;
  const t = fullSeries[globalIndex]?.t;
  if (t == null) return 0;
  return timeToSeriesIndex(new Date(t).toISOString(), slice);
}

/** @deprecated Prefer timeToSeriesIndex with full series. */
export function timeToHistoryIndex(
  at: string,
  historyLen: number,
  spanMs: number = CHART_FULL_SPAN_MS,
): number {
  const age = Date.now() - new Date(at).getTime();
  const t = 1 - Math.min(1, Math.max(0, age / spanMs));
  return Math.round(t * Math.max(0, historyLen - 1));
}

export function buildCredibilityHistory(
  market: EnrichedMarketDetail,
  yesSeries: number[],
): number[] {
  const totalRep =
    market.credibility.yes.total_reputation + market.credibility.no.total_reputation || 1;
  const credBias =
    (market.credibility.yes.total_reputation - market.credibility.no.total_reputation) /
    totalRep;

  return yesSeries.map((p, i) => {
    const drift = credBias * 6 * (0.6 + (i / Math.max(1, yesSeries.length - 1)) * 0.4);
    return Math.max(0, Math.min(100, Math.round(p + drift)));
  });
}

export function buildAgentPositionMarkers(market: EnrichedMarketDetail): AgentPositionMarker[] {
  const series = buildProbHistorySeries(market);
  const markers: AgentPositionMarker[] = [];

  for (const take of market.agent_takes) {
    const h = hash(take.slug);
    const hoursAgo = 6 + (h % 80);
    const at = new Date(Date.now() - hoursAgo * HOUR_MS).toISOString();
    markers.push({
      id: `pos-${take.slug}`,
      agentName: take.name,
      agentSlug: take.slug,
      side: take.side,
      confidence: Math.round(take.confidence),
      at,
      historyIndex: timeToSeriesIndex(at, series),
    });
  }

  for (const mover of market.why_moving.first_movers.slice(0, 3)) {
    const at = new Date(Date.now() - (8 + (hash(mover.slug) % 36)) * HOUR_MS).toISOString();
    markers.push({
      id: `pos-mover-${mover.slug}`,
      agentName: mover.name,
      agentSlug: mover.slug,
      side: mover.event_type.toLowerCase().includes("no") ? "NO" : "YES",
      confidence: mover.event_type.toLowerCase().includes("no")
        ? Math.max(8, 100 - Math.round(market.current_yes_probability))
        : Math.round(market.current_yes_probability),
      at,
      historyIndex: timeToSeriesIndex(at, series),
    });
  }

  return markers.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

/** Volume / participation aligned to visible probability points. */
export function buildMarketActivitySeries(
  market: EnrichedMarketDetail,
  series: ProbHistoryPoint[],
): MarketActivityPoint[] {
  const h = hash(market.slug);
  const baseVol = (market.public_exposure ?? 12 + (h % 40)) * 1000;
  const baseAgents = market.agent_count;
  const len = series.length;

  return series.map((pt, i) => {
    const t = i / Math.max(1, len - 1);
    const wave = Math.sin(t * Math.PI * 3.1 + h * 0.07) * 0.22;
    const ramp = 0.55 + t * 0.55;
    const volSpike = Math.abs(pt.yes - (series[i - 1]?.yes ?? pt.yes)) > 2.5 ? 1.35 : 1;
    return {
      volume: Math.round(baseVol * ramp * (1 + wave) * volSpike),
      participation: Math.max(
        2,
        Math.round(baseAgents * (0.45 + t * 0.55) * (1 + wave * 0.45)),
      ),
    };
  });
}

export function buildNarrativeInfluenceHistory(
  market: EnrichedMarketDetail,
  yesSeries: number[],
): number[] {
  const totalRep =
    market.credibility.yes.total_reputation + market.credibility.no.total_reputation || 1;
  const narrativeBias = market.narrative_velocity / 100;
  const repBias =
    (market.credibility.yes.total_reputation - market.credibility.no.total_reputation) /
    totalRep;

  return yesSeries.map((p, i) => {
    const t = i / Math.max(1, yesSeries.length - 1);
    const shift = (repBias * 5 + narrativeBias * 8) * (0.5 + t * 0.5);
    return Math.max(0, Math.min(100, Math.round(p + shift)));
  });
}

export function formatRangeAxisLabel(range: ChartTimeRange, points: ProbHistoryPoint[]): string {
  if (points.length === 0) {
    switch (range) {
      case "1D":
        return "24h ago";
      case "1W":
        return "7d ago";
      case "1M":
        return "30d ago";
      case "3M":
        return "90d ago";
      default:
        return "Start";
    }
  }
  return formatChartTimestamp(points[0].t);
}

export function formatChartTimestamp(ts: number, range?: ChartTimeRange): string {
  const date = new Date(ts);
  if (range === "1D") {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatChartTimeShort(ts: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ts));
}

export function formatVolume(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000).toLocaleString()},000`;
  return `$${value.toLocaleString()}`;
}
