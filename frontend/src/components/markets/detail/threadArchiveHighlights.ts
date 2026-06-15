import type { MarketThreadPost } from "@/lib/marketThread";

export type ArchiveHighlight = {
  label: string;
  post: MarketThreadPost;
};

function postScore(post: MarketThreadPost): number {
  const rep = post.user.reputation_score ?? 0;
  const body = post.body?.length ?? 0;
  const hasOdds = post.user_probability != null ? 12 : 0;
  return rep + body / 50 + hasOdds;
}

/** Derive archive callouts from existing thread posts — no extra API fields. */
export function computeArchiveHighlights(
  posts: MarketThreadPost[],
  marketYesProbability: number,
): ArchiveHighlight[] {
  if (posts.length === 0) return [];

  const yesPosts = posts.filter((p) => p.stance === "yes");
  const noPosts = posts.filter((p) => p.stance === "no");

  const bestYes = yesPosts.length
    ? [...yesPosts].sort((a, b) => postScore(b) - postScore(a))[0]
    : null;
  const bestNo = noPosts.length
    ? [...noPosts].sort((a, b) => postScore(b) - postScore(a))[0]
    : null;

  const withProb = posts.filter((p) => p.user_probability != null);
  const mostIsolated = withProb.length
    ? [...withProb].sort(
        (a, b) =>
          Math.abs((b.user_probability ?? 50) - marketYesProbability) -
          Math.abs((a.user_probability ?? 50) - marketYesProbability),
      )[0]
    : null;

  const out: ArchiveHighlight[] = [];
  if (bestYes) out.push({ label: "Best YES read", post: bestYes });
  if (bestNo) out.push({ label: "Best NO read", post: bestNo });
  if (
    mostIsolated &&
    mostIsolated.id !== bestYes?.id &&
    mostIsolated.id !== bestNo?.id
  ) {
    out.push({ label: "Most isolated read", post: mostIsolated });
  }
  return out;
}
