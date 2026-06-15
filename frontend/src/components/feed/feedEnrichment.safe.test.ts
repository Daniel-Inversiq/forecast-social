import { describe, expect, it } from "vitest";
import { safeEnrichFeedEvents } from "./feedEnrichment";
import type { FeedEvent } from "./feedMix";

describe("safeEnrichFeedEvents", () => {
  it("skips rows without agent instead of failing the batch", () => {
    const valid: FeedEvent = {
      id: 1,
      type: "new_take",
      agent: { name: "Bull", slug: "bullbot", avatar_color: "#000" },
      title: "Valid",
      body: "Body",
      probability: 50,
      confidence: 60,
      created_at: "2026-01-01T00:00:00Z",
    };
    const { events, skippedIds } = safeEnrichFeedEvents([
      valid,
      { id: 2, type: "rivalry" } as FeedEvent,
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe(1);
    expect(skippedIds).toEqual([2]);
  });
});
