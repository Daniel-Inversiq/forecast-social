import type { MarketThreadPost } from "@/lib/marketThread";

export type ThreadSortKey = "top" | "new";

/**
 * "Top" ranks substance, not votes (the thread has no vote data — nothing is
 * fabricated): counter-theses and odds-on-record posts first, then authors
 * with reputation, then longer reasoning. "New" is reverse-chronological.
 */
export function sortThreadPosts(
  posts: MarketThreadPost[],
  sort: ThreadSortKey,
): MarketThreadPost[] {
  const byNewest = (a: MarketThreadPost, b: MarketThreadPost) =>
    Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? "");
  if (sort === "new") return [...posts].sort(byNewest);

  const score = (p: MarketThreadPost) =>
    (p.post_type === "counter-thesis" ? 400 : 0) +
    (p.user_probability != null ? 200 : 0) +
    Math.min(100, p.user.reputation_score ?? 0) +
    Math.min(80, p.body.length / 5);

  return [...posts].sort((a, b) => {
    const diff = score(b) - score(a);
    return diff !== 0 ? diff : byNewest(a, b);
  });
}
