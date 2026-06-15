import { describe, expect, it } from "vitest";
import type { EnrichedMarket } from "./types";
import { pickResolvingSoon } from "./ResolvingSoonRail";

function makeMarket(overrides: Partial<EnrichedMarket>): EnrichedMarket {
  return {
    title: "US recession by Q4",
    category: "Macro",
    status: "open",
    current_yes_probability: 61,
    agent_count: 24,
    narrative: "",
    urgency: "hot",
    forecast_thesis: "",
    slug: "us-recession-by-q4",
    resolution_horizon: null,
    movement_delta: 0,
    narrative_cluster: "",
    why_moved: "",
    disagreement_pct: 30,
    yes_lean_pct: 60,
    receipts_count: 2,
    leading_agents: [],
    top_take: "",
    early_agent: "",
    disagree_agent: "",
    copied_position: "",
    reputation_conflict: "low",
    sentiment: "neutral",
    in_network: false,
    narrative_state: "consensus building",
    narrative_state_label: "",
    pressure: {
      crowding: 0,
      disagreement_spread: 0,
      conviction_velocity: 0,
      reputation_imbalance: 0,
      momentum_acceleration: 0,
      timing_divergence: 0,
    },
    pressure_headline: "",
    agent_lead_line: "",
    reputation_yes_share: 0.5,
    market_memory: [],
    ...overrides,
  } as EnrichedMarket;
}

function horizon(bucket: string, hours: number) {
  return {
    bucket,
    filter_bucket: "resolves_soon",
    label: "",
    emoji: "⚡",
    short_label: "",
    open_loop: null,
    hours_remaining: hours,
  } as EnrichedMarket["resolution_horizon"];
}

describe("pickResolvingSoon", () => {
  it("returns only open markets resolving tonight or soon, nearest first", () => {
    const markets = [
      makeMarket({ slug: "a", resolution_horizon: horizon("soon", 40) }),
      makeMarket({ slug: "b", resolution_horizon: horizon("tonight", 3) }),
      makeMarket({ slug: "c", resolution_horizon: horizon("this_week", 100) }),
      makeMarket({ slug: "d", resolution_horizon: null }),
      makeMarket({
        slug: "e",
        status: "resolved",
        resolution_horizon: horizon("tonight", 1),
      }),
    ];
    expect(pickResolvingSoon(markets).map((m) => m.slug)).toEqual(["b", "a"]);
  });

  it("caps the rail at the limit", () => {
    const markets = Array.from({ length: 10 }, (_, i) =>
      makeMarket({ slug: `m${i}`, resolution_horizon: horizon("soon", i + 1) }),
    );
    expect(pickResolvingSoon(markets, 6)).toHaveLength(6);
  });
});
