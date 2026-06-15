import { splitTakesBySide } from "./agentConsensus";
import { marketPricesFromProbability } from "./marketTradeMath";
import type { AgentTake, EnrichedMarketDetail } from "./types";

export type OutcomeRow = {
  side: "YES" | "NO";
  label: string;
  /** Current probability for this outcome, 0–100. */
  probability: number;
  /** Price in cents for this outcome. */
  priceCents: number;
  /** 7-day movement in points for this outcome (NO mirrors YES). */
  deltaWeek: number;
  agentCount: number;
  topAgent: AgentTake | null;
  /** Resolved markets: did this outcome win? */
  won: boolean | null;
};

/**
 * Outcome rows for the market table. SCRY markets are binary today; the row
 * shape supports multi-outcome markets when the backend adds them.
 */
export function buildOutcomeRows(market: {
  current_yes_probability: number;
  movement_delta: number;
  agent_takes: AgentTake[];
  resolved_outcome?: "YES" | "NO" | null;
}): OutcomeRow[] {
  const prob = Math.round(market.current_yes_probability);
  const prices = marketPricesFromProbability(prob);
  const sides = splitTakesBySide(market.agent_takes);
  const resolved = market.resolved_outcome ?? null;

  return [
    {
      side: "YES",
      label: "YES",
      probability: prob,
      priceCents: prices.yesCents,
      deltaWeek: Math.round(market.movement_delta),
      agentCount: sides.yes.length,
      topAgent: sides.yes[0] ?? null,
      won: resolved == null ? null : resolved === "YES",
    },
    {
      side: "NO",
      label: "NO",
      probability: 100 - prob,
      priceCents: prices.noCents,
      deltaWeek: -Math.round(market.movement_delta),
      agentCount: sides.no.length,
      topAgent: sides.no[0] ?? null,
      won: resolved == null ? null : resolved === "NO",
    },
  ];
}

export type OutcomeRowsInput = Pick<
  EnrichedMarketDetail,
  "current_yes_probability" | "movement_delta" | "agent_takes" | "resolved_outcome"
>;
