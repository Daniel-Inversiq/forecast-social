import { describe, expect, it } from "vitest";
import type { FeedEvent } from "@/components/feed/feedMix";
import { orderFeedForDisplay } from "@/lib/feedStreamMerge";
import {
  isThreadReplyNearDuplicateExempt,
  normalizeFeedTitle,
  suppressNearDuplicateFeedEvents,
  type NearDuplicateSuppression,
} from "@/lib/feedNearDuplicate";

function mockEvent(overrides: Partial<FeedEvent> & Pick<FeedEvent, "created_at">): FeedEvent {
  return {
    type: "new_take",
    agent: { name: "BullBot", slug: "bullbot", avatar_color: "#000" },
    title: overrides.title ?? "The long side wins.",
    body: "Body",
    probability: null,
    confidence: null,
    ...overrides,
  };
}

describe("normalizeFeedTitle", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeFeedTitle("The Long Side Wins.")).toBe("the long side wins");
    expect(normalizeFeedTitle("  Same   Title!!  ")).toBe("same title");
  });
});

describe("suppressNearDuplicateFeedEvents", () => {
  it("dedupes same agent + normalized title in For You, keeping highest score", () => {
    const events = [
      mockEvent({
        id: 1,
        created_at: "2026-06-08T10:00:00Z",
        feed_score: 12,
        title: "The long side wins.",
      }),
      mockEvent({
        id: 2,
        created_at: "2026-06-08T09:00:00Z",
        feed_score: 28,
        title: "The Long Side Wins!",
      }),
      mockEvent({
        id: 3,
        created_at: "2026-06-08T08:00:00Z",
        feed_score: 5,
        title: "Different thesis",
      }),
    ];
    const suppressions: NearDuplicateSuppression[] = [];
    const result = suppressNearDuplicateFeedEvents(events, "For You", suppressions);

    expect(result.map((e) => e.id)).toEqual([2, 3]);
    expect(suppressions).toHaveLength(1);
    expect(suppressions[0]?.reason).toBe("near_duplicate");
    expect(suppressions[0]?.feed_item_id).toBe(1);
    expect(suppressions[0]?.suppressed_in_favor_of.feed_item_id).toBe(2);
    expect(result[0]?.near_duplicate_debug?.suppressed_count).toBe(1);
  });

  it("dedupes in Latest mode, keeping newest publish time", () => {
    const events = [
      mockEvent({
        id: 1,
        created_at: "2026-06-08T10:00:00Z",
        feed_published_at: "2026-06-08T10:00:00Z",
        feed_score: 50,
        title: "The long side wins.",
      }),
      mockEvent({
        id: 2,
        created_at: "2026-06-08T11:00:00Z",
        feed_published_at: "2026-06-08T11:00:00Z",
        feed_score: 10,
        title: "The long side wins",
      }),
    ];
    const result = suppressNearDuplicateFeedEvents(events, "Latest");
    expect(result.map((e) => e.id)).toEqual([2]);
  });

  it("does not dedupe receipt against post with same title", () => {
    const events = [
      mockEvent({
        id: 1,
        type: "new_take",
        created_at: "2026-06-08T10:00:00Z",
        title: "Called it on NVDA",
      }),
      mockEvent({
        id: 2,
        type: "receipt",
        card_kind: "receipt",
        created_at: "2026-06-08T09:00:00Z",
        title: "Called it on NVDA",
      }),
    ];
    const result = suppressNearDuplicateFeedEvents(events, "For You");
    expect(result).toHaveLength(2);
  });

  it("exempts thread replies with different parent_activity_id in same thread block", () => {
    const events = [
      mockEvent({
        id: 1,
        created_at: "2026-06-08T12:00:00Z",
        generated_activity_id: "root",
        thread_id: "thread-a",
        parent_activity_id: null,
        title: "Root thesis",
      }),
      mockEvent({
        id: 2,
        created_at: "2026-06-08T11:00:00Z",
        generated_activity_id: "reply-1",
        thread_id: "thread-a",
        parent_activity_id: "root",
        activity_type: "rival_reply",
        type: "rivalry",
        title: "Counter point",
      }),
      mockEvent({
        id: 3,
        created_at: "2026-06-08T10:00:00Z",
        generated_activity_id: "reply-2",
        thread_id: "thread-a",
        parent_activity_id: "reply-1",
        activity_type: "rival_reply",
        type: "rivalry",
        title: "Counter point",
      }),
    ];

    expect(isThreadReplyNearDuplicateExempt(events[1]!, events, 1)).toBe(true);
    expect(isThreadReplyNearDuplicateExempt(events[2]!, events, 2)).toBe(true);

    const result = suppressNearDuplicateFeedEvents(events, "Latest");
    expect(result.map((e) => e.generated_activity_id)).toEqual(["root", "reply-1", "reply-2"]);
  });

  it("dedupes duplicate root posts with same agent and title", () => {
    const events = [
      mockEvent({
        id: 10,
        created_at: "2026-06-08T10:00:00Z",
        title: "The long side wins.",
      }),
      mockEvent({
        id: 20,
        created_at: "2026-06-08T08:00:00Z",
        title: "The long side wins",
      }),
      mockEvent({
        id: 30,
        created_at: "2026-06-08T07:00:00Z",
        agent: { name: "Other", slug: "other", avatar_color: "#111" },
        title: "The long side wins.",
      }),
    ];
    const suppressions: NearDuplicateSuppression[] = [];
    const result = suppressNearDuplicateFeedEvents(events, "Latest", suppressions);

    expect(result.map((e) => e.id)).toEqual([10, 30]);
    expect(suppressions).toHaveLength(1);
    expect(suppressions[0]?.normalized_title).toBe("the long side wins");
  });
});

describe("orderFeedForDisplay near-duplicate integration", () => {
  it("applies near-duplicate suppression after ordering", () => {
    const events = [
      mockEvent({ id: 1, created_at: "2026-06-08T10:00:00Z", feed_score: 5, title: "Same title" }),
      mockEvent({ id: 2, created_at: "2026-06-08T09:00:00Z", feed_score: 40, title: "Same title" }),
    ];
    const suppressions: NearDuplicateSuppression[] = [];
    const ordered = orderFeedForDisplay(events, "For You", Date.now(), { nearDuplicateSuppressions: suppressions });
    expect(ordered.map((e) => e.id)).toEqual([2]);
    expect(suppressions[0]?.reason).toBe("near_duplicate");
  });
});
