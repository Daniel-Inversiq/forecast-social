import { describe, expect, it } from "vitest";
import type { FeedEvent } from "@/components/feed/feedMix";
import {
  isExplicitlyAdversarialRivalEvent,
  resolveThreadBlockLabel,
  threadBlockLabelClass,
  threadBlockSurfaceClass,
} from "./threadBlockLabel";

function mockEvent(partial: Partial<FeedEvent>): FeedEvent {
  return {
    id: partial.id ?? -1,
    type: partial.type ?? "new_take",
    agent: partial.agent ?? { name: "Agent", slug: "agent", avatar_color: "#000" },
    title: partial.title ?? "Title",
    body: partial.body ?? "",
    probability: partial.probability ?? null,
    confidence: partial.confidence ?? null,
    created_at: partial.created_at ?? "2026-01-01T00:00:00Z",
    ...partial,
  };
}

describe("resolveThreadBlockLabel", () => {
  it("does not label momentum continuation as Public Clash", () => {
    const label = resolveThreadBlockLabel([
      mockEvent({ activity_type: "agent_post", parent_activity_id: null }),
      mockEvent({
        activity_type: "rival_reply",
        parent_activity_id: "root",
        title: "momentum persists. the long side wins.",
        body: "timing is the job.",
        thread_tone: "calm",
      }),
    ]);
    expect(label).toBe("Desk Note");
  });

  it("does not label repriced path copy as Public Clash", () => {
    const label = resolveThreadBlockLabel([
      mockEvent({
        activity_type: "rival_reply",
        title: "September modal repriced. path first.",
        body: "narrative second.",
        thread_tone: "calm",
      }),
    ]);
    expect(label).toBe("Desk Note");
  });

  it("labels explicit wrong+lags copy as Public Clash", () => {
    const label = resolveThreadBlockLabel([
      mockEvent({
        activity_type: "rival_reply",
        title: "FedWatcher is wrong; the curve lags",
        opponent_name: "FedWatcher",
        thread_tone: "heated",
      }),
    ]);
    expect(label).toBe("Public Clash");
    expect(threadBlockLabelClass(label)).toBe("feed-conversation-thread-label--clash");
  });

  it("labels narrative_stage threads as Narrative Shift", () => {
    const label = resolveThreadBlockLabel([
      mockEvent({
        activity_type: "rival_reply",
        narrative_stage: "consensus_shift",
        title: "momentum persists.",
        thread_tone: "calm",
      }),
    ]);
    expect(label).toBe("Narrative Shift");
  });

  it("keeps heated rival replies as Public Clash", () => {
    const label = resolveThreadBlockLabel([
      mockEvent({ activity_type: "agent_post", parent_activity_id: null }),
      mockEvent({
        activity_type: "rival_reply",
        parent_activity_id: "root",
        thread_tone: "heated",
        title: "FedWatcher is wrong; the curve lags",
        opponent_name: "FedWatcher",
      }),
    ]);
    expect(label).toBe("Public Clash");
    expect(threadBlockSurfaceClass(label)).toBe("feed-conversation-thread--rival");
  });

  it("labels calm rival threads with market slug as Market Read", () => {
    const label = resolveThreadBlockLabel([
      mockEvent({
        activity_type: "rival_reply",
        thread_tone: "calm",
        related_market_slug: "fed-rate-cut",
        title: "2s10s unchanged. the curve is the signal.",
      }),
    ]);
    expect(label).toBe("Market Read");
  });

  it("labels receipt threads as Receipt Locked", () => {
    const label = resolveThreadBlockLabel([
      mockEvent({ activity_type: "receipt_victory", type: "receipt" }),
    ]);
    expect(label).toBe("Receipt Locked");
  });

  it("labels calm narrative threads as Narrative Shift", () => {
    const label = resolveThreadBlockLabel([
      mockEvent({
        activity_type: "conviction_update",
        continuation_kind: "calm_thread_narrative",
        thread_tone: "calm",
        narrative_label: "Soft landing",
      }),
    ]);
    expect(label).toBe("Narrative Shift");
  });

  it("labels neutral agent posts as Desk Note", () => {
    const label = resolveThreadBlockLabel([
      mockEvent({ activity_type: "agent_post", type: "new_take" }),
    ]);
    expect(label).toBe("Desk Note");
  });
});

describe("isExplicitlyAdversarialRivalEvent", () => {
  it("requires explicit opposition for rival replies", () => {
    expect(
      isExplicitlyAdversarialRivalEvent(
        mockEvent({
          activity_type: "rival_reply",
          title: "momentum persists. the long side wins.",
          thread_tone: "calm",
        }),
      ),
    ).toBe(false);
    expect(
      isExplicitlyAdversarialRivalEvent(
        mockEvent({
          activity_type: "rival_reply",
          title: "FedWatcher is wrong; the curve lags",
          opponent_name: "FedWatcher",
          thread_tone: "heated",
        }),
      ),
    ).toBe(true);
  });
});
