import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { FeedEvent } from "./feedMix";

vi.mock("next/link", () => ({
  default: function MockLink({
    children,
    href,
    ...rest
  }: {
    children: ReactNode;
    href: string;
    className?: string;
    "aria-label"?: string;
  }) {
    return createElement("a", { href, ...rest }, children);
  },
}));

import { FeedConversationThreadBlock } from "./FeedConversationThreadBlock";

function mockThreadEvent(
  partial: Partial<FeedEvent> & Pick<FeedEvent, "generated_activity_id">,
): FeedEvent {
  return {
    id: partial.id ?? -1,
    type: partial.type ?? "rivalry",
    agent: partial.agent ?? {
      name: "Macro Oracle",
      slug: "macro-oracle",
      avatar_color: "#7c3aed",
    },
    title: partial.title ?? "Root thesis",
    body: partial.body ?? "",
    probability: partial.probability ?? null,
    confidence: partial.confidence ?? null,
    created_at: partial.created_at ?? "2026-01-01T00:00:00Z",
    thread_id: partial.thread_id ?? "thread-1",
    parent_activity_id: partial.parent_activity_id ?? null,
    generated_activity_id: partial.generated_activity_id,
    activity_type: partial.activity_type ?? "agent_post",
    ...partial,
  };
}

describe("FeedConversationThreadBlock", () => {
  it("renders root and reply rows with agent names and copy", () => {
    const html = renderToStaticMarkup(
      createElement(FeedConversationThreadBlock, {
        events: [
          mockThreadEvent({
            generated_activity_id: "act-root",
            parent_activity_id: null,
            activity_type: "agent_post",
            type: "new_take",
            title: "Curve steepened into the print.",
            agent: {
              name: "FedWatcher",
              slug: "fed-watcher",
              avatar_color: "#06b6d4",
            },
          }),
          mockThreadEvent({
            generated_activity_id: "act-reply",
            parent_activity_id: "act-root",
            activity_type: "rival_reply",
            title: "September modal repriced.",
            agent: {
              name: "Macro Oracle",
              slug: "macro-oracle",
              avatar_color: "#7c3aed",
            },
          }),
        ],
      }),
    );

    expect(html).toContain("Agent conversation");
    expect(html).toContain("feed-conversation-thread-line--root");
    expect(html).toContain("feed-conversation-thread-replies");
    expect(html).toContain("feed-conversation-thread-line--reply");
    expect(html).toContain("FedWatcher");
    expect(html).toContain("Macro Oracle");
    expect(html).toContain("Curve steepened into the print.");
    expect(html).toContain("September modal repriced.");
    expect(html).toContain("/agents/fed-watcher");
    expect(html).toContain("/agents/macro-oracle");
  });

  it("applies motion stagger classes without throwing", () => {
    const html = renderToStaticMarkup(
      createElement(FeedConversationThreadBlock, {
        index: 3,
        events: [
          mockThreadEvent({
            generated_activity_id: "act-root",
            parent_activity_id: null,
            title: "Still buying.",
          }),
        ],
      }),
    );

    expect(html).toContain("feed-card-enter");
    expect(html).toContain("feed-stagger-3");
    expect(html).not.toContain("Could not render feed item");
  });
});
