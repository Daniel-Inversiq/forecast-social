import { BATTLE_BELIEF_LINKS, FALLBACK_BELIEFS } from "./fallbackData";
import type {
  Belief,
  BeliefFilterKey,
  BeliefRankingTypeKey,
  BeliefSortKey,
  EnrichedBelief,
  RankedBelief,
} from "./types";

function hashSeed(s: string) {
  return s.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

export function enrichBelief(belief: Belief, index: number): EnrichedBelief {
  const h = hashSeed(belief.slug);
  const contested_score = Math.round(
    (belief.for_side.credibility + belief.against_side.credibility) / 40 +
      belief.consensus_divergence,
  );
  const linked_battle_ids = Object.entries(BATTLE_BELIEF_LINKS)
    .filter(
      ([, link]) =>
        link.for_slug === belief.slug || link.against_slug === belief.slug,
    )
    .map(([id]) => id);

  return {
    ...belief,
    contested_score,
    is_rising: belief.momentum > 10,
    linked_battle_ids,
  };
}

export function filterBeliefs(
  beliefs: EnrichedBelief[],
  filter: BeliefFilterKey,
  query: string,
): EnrichedBelief[] {
  let list = beliefs;
  const q = query.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.opposing_belief_title.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q),
    );
  }
  switch (filter) {
    case "macro":
    case "politics":
    case "crypto":
    case "ai":
    case "tech":
      list = list.filter((b) => b.category.toLowerCase() === filter);
      break;
    case "active":
      list = list.filter((b) => b.status === "active");
      break;
    case "contested":
      list = list.filter((b) => b.contested_score >= 80);
      break;
    default:
      break;
  }
  return list;
}

export function sortBeliefs(
  beliefs: EnrichedBelief[],
  sort: BeliefSortKey,
): EnrichedBelief[] {
  const copy = [...beliefs];
  switch (sort) {
    case "credibility":
      return copy.sort((a, b) => b.supporting_credibility - a.supporting_credibility);
    case "contested":
      return copy.sort((a, b) => b.contested_score - a.contested_score);
    case "rising":
      return copy.sort((a, b) => b.momentum - a.momentum);
    case "win_rate":
      return copy.sort((a, b) => b.historical_win_rate - a.historical_win_rate);
    case "followers":
      return copy.sort((a, b) => b.follower_count - a.follower_count);
    default:
      return copy;
  }
}

export function rankBeliefsByType(
  beliefs: EnrichedBelief[],
  rankingType: BeliefRankingTypeKey,
): RankedBelief[] {
  let sorted: EnrichedBelief[];
  switch (rankingType) {
    case "top_champions":
      sorted = [...beliefs].sort(
        (a, b) => (b.champions[0]?.credibility ?? 0) - (a.champions[0]?.credibility ?? 0),
      );
      break;
    case "most_accurate":
      sorted = [...beliefs].sort((a, b) => b.historical_win_rate - a.historical_win_rate);
      break;
    case "fastest_rising":
      sorted = [...beliefs].sort((a, b) => b.momentum - a.momentum);
      break;
    case "highest_credibility":
      sorted = [...beliefs].sort(
        (a, b) => b.supporting_credibility - a.supporting_credibility,
      );
      break;
    case "most_contested":
      sorted = [...beliefs].sort((a, b) => b.contested_score - a.contested_score);
      break;
    default:
      sorted = beliefs;
  }
  return sorted.map((b, i) => ({
    ...b,
    rank: i + 1,
    champion_name: b.champions[0]?.name,
    champion_slug: b.champions[0]?.slug,
  }));
}

export function getBeliefBySlug(slug: string): EnrichedBelief | null {
  const raw = FALLBACK_BELIEFS.find((b) => b.slug === slug);
  if (!raw) return null;
  const idx = FALLBACK_BELIEFS.indexOf(raw);
  return enrichBelief(raw, idx);
}

export function getBattleBeliefLink(battleId: string) {
  return BATTLE_BELIEF_LINKS[battleId] ?? null;
}

export function beliefPath(slug: string) {
  return `/beliefs/${slug}`;
}
