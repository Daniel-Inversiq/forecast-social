import { describe, expect, it } from "vitest";
import type { FeedEvent } from "@/components/feed/feedMix";
import {
  countThreadBlocksRendered,
  sortFeedByThreadBlockTimeDesc,
} from "@/lib/feedOrdering";

function mockEvent(overrides: Partial<FeedEvent> & Pick<FeedEvent, "created_at">): FeedEvent {
  return {
    type: "rivalry",
    agent: { name: "Agent", slug: "agent", avatar_color: "#000" },
    title: overrides.title ?? "Title",
    body: "Body",
    probability: null,
    confidence: null,
    ...overrides,
  };
}

describe("sortFeedByThreadBlockTimeDesc", () => {
  it("keeps thread members adjacent and orders blocks by newest item", () => {
    const ordered = sortFeedByThreadBlockTimeDesc([
      mockEvent({
        generated_activity_id: "older-root",
        thread_id: "older-root",
        parent_activity_id: null,
        created_at: "2026-06-08T08:00:00Z",
      }),
      mockEvent({
        generated_activity_id: "older-reply",
        thread_id: "older-root",
        parent_activity_id: "older-root",
        created_at: "2026-06-08T08:30:00Z",
      }),
      mockEvent({
        generated_activity_id: "newer-root",
        thread_id: "newer-root",
        parent_activity_id: null,
        created_at: "2026-06-08T10:00:00Z",
      }),
      mockEvent({
        generated_activity_id: "newer-reply",
        thread_id: "newer-root",
        parent_activity_id: "newer-root",
        created_at: "2026-06-08T12:00:00Z",
      }),
    ]);

    expect(ordered.map((e) => e.generated_activity_id)).toEqual([
      "newer-root",
      "newer-reply",
      "older-root",
      "older-reply",
    ]);
    expect(countThreadBlocksRendered(ordered)).toBe(2);
  });
});
