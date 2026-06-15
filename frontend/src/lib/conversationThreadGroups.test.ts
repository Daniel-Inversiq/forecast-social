import { describe, expect, it } from "vitest";
import {
  buildConversationRenderKey,
  conversationRenderKeysAreUnique,
  groupConversationDisplayItems,
  mockConversationStreamEvent,
  streamItemStableId,
} from "./conversationThreadGroups";

describe("conversationThreadGroups", () => {
  it("assigns unique renderKeys when the same threadId appears in non-adjacent segments", () => {
    const threadId = "thread-root-abc";
    const streamItems = [
      mockConversationStreamEvent(
        {
          generated_activity_id: "act-root",
          thread_id: threadId,
          parent_activity_id: null,
          activity_type: "agent_post",
          type: "new_take",
        },
        0,
      ),
      mockConversationStreamEvent(
        {
          generated_activity_id: "act-reply-1",
          thread_id: threadId,
          parent_activity_id: "act-root",
          activity_type: "rival_reply",
        },
        1,
      ),
      mockConversationStreamEvent(
        {
          id: 999,
          generated_activity_id: "act-unrelated",
          thread_id: "other-thread",
          parent_activity_id: null,
          activity_type: "agent_post",
          type: "new_take",
        },
        2,
      ),
      mockConversationStreamEvent(
        {
          generated_activity_id: "act-reply-2",
          thread_id: threadId,
          parent_activity_id: "act-reply-1",
          activity_type: "rival_reply",
        },
        3,
      ),
    ];

    const groups = groupConversationDisplayItems(streamItems);
    const threadGroups = groups.filter((g) => g.kind === "thread");

    expect(threadGroups).toHaveLength(2);
    expect(threadGroups[0]!.kind === "thread" && threadGroups[0].threadId).toBe(threadId);
    expect(threadGroups[1]!.kind === "thread" && threadGroups[1].threadId).toBe(threadId);
    expect(threadGroups[0]!.renderKey).not.toBe(threadGroups[1]!.renderKey);
    expect(conversationRenderKeysAreUnique(groups)).toBe(true);
  });

  it("keeps standalone events unique even when threadIds repeat elsewhere", () => {
    const groups = groupConversationDisplayItems([
      mockConversationStreamEvent(
        {
          id: 1,
          generated_activity_id: "solo-1",
          thread_id: "solo-1",
          parent_activity_id: null,
          activity_type: "agent_post",
          type: "new_take",
        },
        0,
      ),
      mockConversationStreamEvent(
        {
          id: 2,
          generated_activity_id: "solo-2",
          thread_id: "solo-2",
          parent_activity_id: null,
          activity_type: "agent_post",
          type: "new_take",
        },
        1,
      ),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.kind === "single")).toBe(true);
    expect(conversationRenderKeysAreUnique(groups)).toBe(true);
  });

  it("builds composite thread keys from threadId, anchor ids, and sequence", () => {
    const root = mockConversationStreamEvent(
      {
        generated_activity_id: "root-id",
        thread_id: "shared-thread",
        parent_activity_id: null,
        activity_type: "agent_post",
        type: "new_take",
      },
      0,
    );
    const reply = mockConversationStreamEvent(
      {
        generated_activity_id: "reply-id",
        thread_id: "shared-thread",
        parent_activity_id: "root-id",
        activity_type: "rival_reply",
      },
      1,
    );

    const keyA = buildConversationRenderKey("thread", {
      threadId: "shared-thread",
      items: [root, reply],
      sequence: 0,
    });
    const keyB = buildConversationRenderKey("thread", {
      threadId: "shared-thread",
      items: [reply],
      sequence: 3,
    });

    expect(keyA).toContain("shared-thread");
    expect(keyA).toContain(streamItemStableId(root));
    expect(keyA).toContain(streamItemStableId(reply));
    expect(keyB).toContain("shared-thread");
    expect(keyA).not.toBe(keyB);
  });

  it("produces unique render keys across a large mixed feed (100+ rows)", () => {
    const threadIds = ["thread-a", "thread-b", "thread-c"];
    const streamItems = [];
    let idx = 0;

    for (let n = 0; n < 100; n += 1) {
      const threadId = threadIds[n % threadIds.length]!;
      const isRoot = n % 4 === 0;
      streamItems.push(
        mockConversationStreamEvent(
          {
            generated_activity_id: `act-${n}`,
            thread_id: threadId,
            parent_activity_id: isRoot ? null : `act-${Math.max(0, n - 1)}`,
            activity_type: isRoot ? "agent_post" : "rival_reply",
            type: isRoot ? "new_take" : "rivalry",
          },
          idx++,
        ),
      );
      if (n % 7 === 6) {
        streamItems.push(
          mockConversationStreamEvent(
            {
              id: 10_000 + n,
              generated_activity_id: `solo-${n}`,
              thread_id: `solo-${n}`,
              parent_activity_id: null,
              activity_type: "agent_post",
              type: "new_take",
            },
            idx++,
          ),
        );
      }
    }

    const groups = groupConversationDisplayItems(streamItems);
    expect(groups.length).toBeGreaterThan(50);
    expect(conversationRenderKeysAreUnique(groups)).toBe(true);
  });
});
