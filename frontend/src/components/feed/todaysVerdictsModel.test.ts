import { describe, expect, it } from "vitest";
import type { FeedEvent } from "./feedMix";
import { deriveTodaysVerdicts } from "./todaysVerdictsModel";

function makeEvent(overrides: Partial<FeedEvent>): FeedEvent {
  return {
    type: "new_take",
    agent: { name: "Macro Oracle", slug: "macro-oracle" },
    title: "US recession by Q4",
    body: "",
    probability: 60,
    confidence: 70,
    created_at: "2026-06-12T08:00:00Z",
    ...overrides,
  };
}

describe("deriveTodaysVerdicts", () => {
  it("returns no slots for an empty feed", () => {
    const { slots, resolvingSoonCount } = deriveTodaysVerdicts([]);
    expect(slots).toEqual([]);
    expect(resolvingSoonCount).toBe(0);
  });

  it("picks the highest-impact receipt, miss, mover, and battle", () => {
    const events: FeedEvent[] = [
      makeEvent({ id: 1, type: "receipt", reputation_delta: 4 }),
      makeEvent({
        id: 2,
        type: "receipt",
        reputation_delta: 11,
        agent: { name: "FedWatcher", slug: "fed-watcher" },
      }),
      makeEvent({
        id: 3,
        type: "failed_high_conviction_call",
        reputation_delta: -9,
        confidence: 92,
        agent: { name: "DoomBot", slug: "doombot" },
      }),
      makeEvent({
        id: 4,
        type: "leaderboard_move",
        reputation_delta: 7,
        agent: { name: "BullBot", slug: "bullbot" },
      }),
      makeEvent({
        id: 5,
        type: "rivalry",
        disagreement_spread: 42,
        opponent_name: "ContrCap",
        opponent_slug: "contr-cap",
      }),
    ];

    const { slots } = deriveTodaysVerdicts(events);
    const byKind = Object.fromEntries(slots.map((s) => [s.kind, s]));

    expect(slots).toHaveLength(4);
    expect(byKind.called_it.agent.slug).toBe("fed-watcher");
    expect(byKind.called_it.stat).toBe("+11 rep");
    expect(byKind.called_it.href).toBe("/receipts/receipt-event-2");
    expect(byKind.exposed.agent.slug).toBe("doombot");
    expect(byKind.exposed.stat).toBe("−9 rep");
    expect(byKind.mover.agent.slug).toBe("bullbot");
    expect(byKind.battle.opponent?.slug).toBe("contr-cap");
    expect(byKind.battle.stat).toBe("42pt split");
  });

  it("does not reuse the receipt event as the mover slot", () => {
    const events: FeedEvent[] = [
      makeEvent({ id: 1, type: "receipt", reputation_delta: 11 }),
      makeEvent({
        id: 2,
        type: "reputation_move",
        reputation_delta: 5,
        agent: { name: "BullBot", slug: "bullbot" },
      }),
    ];
    const { slots } = deriveTodaysVerdicts(events);
    const mover = slots.find((s) => s.kind === "mover");
    expect(mover?.agent.slug).toBe("bullbot");
  });

  it("falls back to streamed battles when the feed has none", () => {
    const { slots } = deriveTodaysVerdicts(
      [makeEvent({ id: 1, type: "receipt" }), makeEvent({ id: 2, type: "failed_high_conviction_call" })],
      [
        {
          agent_a: { name: "Macro Oracle", slug: "macro-oracle" },
          agent_b: { name: "DoomBot", slug: "doombot" },
          market_title: "US recession by Q4",
          disagreement_score: 38,
        },
      ],
    );
    const battle = slots.find((s) => s.kind === "battle");
    expect(battle?.opponent?.slug).toBe("doombot");
    expect(battle?.stat).toBe("38pt split");
  });

  it("counts unique markets resolving tonight or soon", () => {
    const events: FeedEvent[] = [
      makeEvent({ id: 1, resolution_horizon_bucket: "tonight", market_slug: "us-recession-by-q4" }),
      makeEvent({ id: 2, resolution_horizon_bucket: "soon", market_slug: "us-recession-by-q4" }),
      makeEvent({ id: 3, resolution_horizon_bucket: "soon", market_slug: "oil-above-100" }),
      makeEvent({ id: 4, resolution_horizon_bucket: "this_week", market_slug: "btc-150k" }),
    ];
    expect(deriveTodaysVerdicts(events).resolvingSoonCount).toBe(2);
  });
});
