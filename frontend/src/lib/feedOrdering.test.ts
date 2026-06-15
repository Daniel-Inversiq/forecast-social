import { describe, expect, it } from "vitest";
import type { FeedEvent } from "@/components/feed/feedMix";
import { mergeGeneratedIntoFeed, type GeneratedActivityItem } from "@/lib/generatedFeed";
import { orderFeedForDisplay } from "@/lib/feedStreamMerge";
import {
  dedupeFeedEvents,
  sortFeedByPublishTimeDesc,
  timestampsAreDescending,
} from "@/lib/feedOrdering";

function mockEvent(overrides: Partial<FeedEvent> & Pick<FeedEvent, "created_at">): FeedEvent {
  return {
    type: "new_take",
    agent: { name: "Agent", slug: "agent", avatar_color: "#000" },
    title: overrides.title ?? "Title",
    body: "Body",
    probability: null,
    confidence: null,
    ...overrides,
  };
}

describe("Latest feed ordering", () => {
  it("sorts by feed_published_at ?? created_at descending", () => {
    const events = sortFeedByPublishTimeDesc([
      mockEvent({ id: 1, created_at: "2026-06-08T08:00:00Z", feed_published_at: "2026-06-08T08:00:00Z" }),
      mockEvent({ id: 2, created_at: "2026-06-08T10:00:00Z", feed_published_at: "2026-06-08T10:00:00Z" }),
      mockEvent({ id: 3, created_at: "2026-06-08T09:00:00Z" }),
    ]);
    expect(events.map((e) => e.id)).toEqual([2, 3, 1]);
    expect(timestampsAreDescending(events)).toBe(true);
  });

  it("dedupes by feed event id and generated_activity_id", () => {
    const events = dedupeFeedEvents([
      mockEvent({ id: 10, created_at: "2026-06-08T10:00:00Z", generated_activity_id: "a1" }),
      mockEvent({ id: 10, created_at: "2026-06-08T09:00:00Z", generated_activity_id: "a1" }),
      mockEvent({ id: 11, created_at: "2026-06-08T08:00:00Z", generated_activity_id: "a1" }),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe(10);
  });

  it("orderFeedForDisplay Latest bypasses variety mix and keeps chronological order", () => {
    const events = [
      mockEvent({
        id: 1,
        type: "rivalry",
        created_at: "2026-06-08T12:00:00Z",
        feed_score: 40,
        card_kind: "open_battle",
      }),
      mockEvent({
        id: 2,
        type: "new_take",
        created_at: "2026-06-08T11:00:00Z",
        feed_score: 10,
        card_kind: "agent_post",
        title: "Second take",
      }),
      mockEvent({
        id: 3,
        type: "receipt",
        created_at: "2026-06-08T10:00:00Z",
        feed_score: 50,
        card_kind: "receipt",
      }),
    ];
    const ordered = orderFeedForDisplay(events, "Latest");
    expect(ordered.map((e) => e.id)).toEqual([1, 2, 3]);
    expect(ordered.every((e) => e.feed_mode === "latest")).toBe(true);
    expect(timestampsAreDescending(ordered)).toBe(true);
  });

  it("mergeGeneratedIntoFeed Latest groups threads and sorts blocks by latest item time", () => {
    const main = [
      mockEvent({
        id: 100,
        created_at: "2026-06-08T09:00:00Z",
        feed_published_at: "2026-06-08T09:00:00Z",
      }),
    ];
    const generated: GeneratedActivityItem[] = [
      {
        activity_id: "thread-root",
        created_at: "2026-06-08T10:00:00Z",
        agent_slug: "agent",
        activity_type: "agent_post",
        title: "Root thesis",
        body: "Root body",
        thread_id: "thread-root",
        parent_activity_id: null,
      },
      {
        activity_id: "thread-reply",
        created_at: "2026-06-08T12:00:00Z",
        agent_slug: "rival",
        activity_type: "rival_reply",
        title: "Reply thesis",
        body: "Reply body",
        thread_id: "thread-root",
        parent_activity_id: "thread-root",
      },
      {
        activity_id: "gen-new",
        created_at: "2026-06-08T11:00:00Z",
        agent_slug: "agent",
        activity_type: "agent_post",
        title: "Fresh generated",
        body: "Generated body",
        thread_id: "gen-new",
        parent_activity_id: null,
      },
    ];
    const merged = mergeGeneratedIntoFeed(main, generated, new Map(), "Latest");
    expect(merged[0]?.generated_activity_id).toBe("thread-root");
    expect(merged[1]?.generated_activity_id).toBe("thread-reply");
    expect(merged[0]?.thread_id).toBe("thread-root");
    expect(merged[1]?.thread_id).toBe("thread-root");
    expect(merged[1]?.parent_activity_id).toBe("thread-root");
    expect(merged[2]?.generated_activity_id).toBe("gen-new");
    expect(merged[3]?.id).toBe(100);
  });

  it("mergeGeneratedIntoFeed copies thread fields onto mirrored main rows", () => {
    const main = [
      mockEvent({
        id: 200,
        created_at: "2026-06-08T12:00:00Z",
        feed_published_at: "2026-06-08T12:00:00Z",
        type: "rivalry",
      }),
    ];
    const generated: GeneratedActivityItem[] = [
      {
        activity_id: "mirrored-reply",
        created_at: "2026-06-08T12:00:00Z",
        agent_slug: "rival",
        activity_type: "rival_reply",
        title: "Mirrored reply",
        body: "Reply body",
        thread_id: "thread-root",
        parent_activity_id: "thread-root",
        mirrored_feed_event_id: 200,
      },
    ];
    const merged = mergeGeneratedIntoFeed(main, generated, new Map(), "Latest");
    expect(merged[0]?.generated_activity_id).toBe("mirrored-reply");
    expect(merged[0]?.thread_id).toBe("thread-root");
    expect(merged[0]?.parent_activity_id).toBe("thread-root");
  });
});
