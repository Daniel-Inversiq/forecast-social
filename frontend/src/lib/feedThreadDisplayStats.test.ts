import { describe, expect, it } from "vitest";
import { computeFeedThreadDisplayStats } from "./feedThreadDisplayStats";
import {
  groupConversationDisplayItems,
  mockConversationStreamEvent,
} from "./conversationThreadGroups";

describe("computeFeedThreadDisplayStats", () => {
  it("counts thread blocks and standalone thread candidates", () => {
    const threadId = "thread-root";
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
          generated_activity_id: "act-reply",
          thread_id: threadId,
          parent_activity_id: "act-root",
          activity_type: "rival_reply",
        },
        1,
      ),
      mockConversationStreamEvent(
        {
          id: 42,
          generated_activity_id: "solo-root",
          thread_id: "solo-root",
          parent_activity_id: null,
          activity_type: "agent_post",
          type: "new_take",
        },
        2,
      ),
    ];

    const groups = groupConversationDisplayItems(streamItems);
    const stats = computeFeedThreadDisplayStats(groups);

    expect(stats.thread_blocks_rendered_ui).toBe(1);
    expect(stats.standalone_thread_candidates).toBe(1);
    expect(stats.visible_thread_label_counts["Desk Note"]).toBe(1);
  });
});
