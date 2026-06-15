"use client";

import { useMemo } from "react";
import { MarketMovementSummary } from "./MarketMovementSummary";
import { MarketNarrativeDrivers } from "./MarketNarrativeDrivers";
import { MarketProbabilityChart } from "./MarketProbabilityChart";
import {
  buildMovementSummary,
  buildNarrativeDrivers,
} from "./marketNarrativeInsights";
import type { EnrichedMarketDetail } from "./types";

export function MarketChartSection({ market }: { market: EnrichedMarketDetail }) {
  const summary = useMemo(() => buildMovementSummary(market), [market]);
  const drivers = useMemo(() => buildNarrativeDrivers(market), [market]);

  return (
    <div className="space-y-2 min-w-0">
      <MarketProbabilityChart market={market} compactToolbar />
      <MarketMovementSummary summary={summary} />
      <MarketNarrativeDrivers drivers={drivers} />
    </div>
  );
}
