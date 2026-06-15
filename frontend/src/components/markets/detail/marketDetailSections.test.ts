import { describe, expect, it } from "vitest";
import type { MarketThreadPost } from "@/lib/marketThread";
import { reputationYesShare, splitTakesBySide } from "./agentConsensus";
import { sortThreadPosts } from "./threadSort";
import { pickRecentDrivers } from "./WhyItMovedSection";
import type { ActivityItem, AgentTake, CredibilitySplit } from "./types";

function take(overrides: Partial<AgentTake>): AgentTake {
  return {
    name: "Macro Oracle",
    slug: "macro-oracle",
    side: "YES",
    confidence: 80,
    reasoning: "Leading indicators deteriorating.",
    ...overrides,
  };
}

describe("splitTakesBySide", () => {
  it("splits and sorts each side by reputation, falling back to confidence", () => {
    const takes = [
      take({ slug: "a", side: "YES", reputation_score: 40 }),
      take({ slug: "b", side: "YES", reputation_score: 90 }),
      take({ slug: "c", side: "NO", confidence: 70 }),
      take({ slug: "d", side: "NO", confidence: 95 }),
    ];
    const sides = splitTakesBySide(takes);
    expect(sides.yes.map((t) => t.slug)).toEqual(["b", "a"]);
    expect(sides.no.map((t) => t.slug)).toEqual(["d", "c"]);
  });

  it("computes the YES reputation share from take weights", () => {
    const sides = splitTakesBySide([
      take({ slug: "a", side: "YES", reputation_score: 75 }),
      take({ slug: "b", side: "NO", reputation_score: 25 }),
    ]);
    expect(sides.yesRepShare).toBe(75);
  });

  it("defaults to 50/50 with no takes", () => {
    expect(splitTakesBySide([]).yesRepShare).toBe(50);
  });
});

describe("reputationYesShare", () => {
  it("prefers the backend credibility split when it has weight", () => {
    const split = {
      yes: { total_reputation: 300 },
      no: { total_reputation: 100 },
    } as CredibilitySplit;
    const sides = splitTakesBySide([take({ side: "NO" })]);
    expect(reputationYesShare(split, sides)).toBe(75);
  });

  it("falls back to take-derived share when the split is empty", () => {
    const split = {
      yes: { total_reputation: 0 },
      no: { total_reputation: 0 },
    } as CredibilitySplit;
    const sides = splitTakesBySide([
      take({ slug: "a", side: "YES", reputation_score: 60 }),
      take({ slug: "b", side: "NO", reputation_score: 40 }),
    ]);
    expect(reputationYesShare(split, sides)).toBe(60);
  });
});

function post(overrides: Partial<MarketThreadPost>): MarketThreadPost {
  return {
    id: 1,
    market_id: 1,
    body: "A read on this market that is long enough.",
    stance: "yes",
    post_type: "thesis",
    status: "active",
    created_at: "2026-06-10T10:00:00Z",
    user: { id: 1, username: "trader" },
    ...overrides,
  };
}

describe("sortThreadPosts", () => {
  it("ranks counter-theses with odds above plain theses in Top", () => {
    const posts = [
      post({ id: 1, post_type: "thesis", created_at: "2026-06-12T10:00:00Z" }),
      post({ id: 2, post_type: "counter-thesis", user_probability: 30 }),
    ];
    expect(sortThreadPosts(posts, "top").map((p) => p.id)).toEqual([2, 1]);
  });

  it("New is reverse-chronological regardless of substance", () => {
    const posts = [
      post({ id: 1, post_type: "counter-thesis", user_probability: 30, created_at: "2026-06-10T10:00:00Z" }),
      post({ id: 2, created_at: "2026-06-12T10:00:00Z" }),
    ];
    expect(sortThreadPosts(posts, "new").map((p) => p.id)).toEqual([2, 1]);
  });
});

describe("pickRecentDrivers", () => {
  it("returns newest events first, capped", () => {
    const items: ActivityItem[] = Array.from({ length: 6 }, (_, i) => ({
      type: "new_take",
      agent_name: "A",
      agent_slug: "a",
      title: `t${i}`,
      body: "",
      probability: null,
      confidence: null,
      created_at: `2026-06-0${i + 1}T10:00:00Z`,
    }));
    const picked = pickRecentDrivers(items, 4);
    expect(picked).toHaveLength(4);
    expect(picked[0].title).toBe("t5");
  });
});
