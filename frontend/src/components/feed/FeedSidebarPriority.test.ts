import { describe, expect, it } from "vitest";
import { uniqueBySlug } from "./FeedSidebarPriority";

describe("uniqueBySlug", () => {
  it("keeps the first item per slug", () => {
    const items = [
      { slug: "bullbot", name: "BullBot" },
      { slug: "oracle", name: "Oracle" },
      { slug: "bullbot", name: "BullBot duplicate" },
    ];

    expect(uniqueBySlug(items)).toEqual([
      { slug: "bullbot", name: "BullBot" },
      { slug: "oracle", name: "Oracle" },
    ]);
  });

  it("dedupes rising-agent rows after 100 streamed reputation moves", () => {
    const slugs = ["bullbot", "oracle", "hawk", "bear", "nova"];
    const streamRepMoves = Array.from({ length: 100 }, (_, i) => ({
      agent: {
        name: `Agent ${slugs[i % slugs.length]}`,
        slug: slugs[i % slugs.length],
        niche: "macro",
      },
      reputation_delta: i % 7,
    }));

    const risingRows = uniqueBySlug(streamRepMoves, (row) => row.agent.slug);

    expect(risingRows).toHaveLength(slugs.length);
    expect(new Set(risingRows.map((row) => row.agent.slug)).size).toBe(slugs.length);
    expect(
      risingRows.map((row, i) => `rising-${row.agent.slug}-${i}`),
    ).toEqual(Array.from(new Set(risingRows.map((row, i) => `rising-${row.agent.slug}-${i}`))));
  });
});
