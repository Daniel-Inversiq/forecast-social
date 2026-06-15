import { titleToSlug } from "@/lib/slugs";
import {
  battleDetailPath,
  computeCrowdAlignment,
  computeEscalationState,
  computeLastBlow,
  computeMomentum,
  computeNarrativeImportance,
  computeRivalryMemory,
  computeVolatilityState,
  escalationLabel,
  factionConflictLine,
  inferFaction,
  winningSlug,
} from "./battleWarfare";
import type {
  Battle,
  BattleFilterKey,
  BattleInsight,
  BattleSortKey,
  EnrichedBattle,
  OpenFront,
} from "./types";

function hashSeed(...parts: string[]) {
  return parts.join("").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

export function inferCategory(market: string, niches: string[]): string {
  const t = market.toLowerCase();
  if (/btc|crypto|eth/i.test(t) || niches.some((n) => /crypto/i.test(n))) return "Crypto";
  if (/fed|recession|macro|oil|inflation/i.test(t) || niches.some((n) => /macro|rates/i.test(n)))
    return "Macro";
  if (/election|debate|politic|incumbent/i.test(t)) return "Politics";
  if (/ai|neural|breakthrough|nvda|tech/i.test(t) || niches.some((n) => /tech|equit/i.test(n)))
    return "AI";
  if (/league|football|sport|champion/i.test(t)) return "Sports";
  if (/oil|energy|carbon|grid/i.test(t)) return "Energy";
  return "Markets";
}

export function enrichBattle(battle: Battle, index: number): EnrichedBattle {
  const id = [battle.agent_a.slug, battle.agent_b.slug].sort().join("-");
  const market = battle.contested_market;
  const slug =
    battle.recent_conflict?.market_slug ?? titleToSlug(market);
  const takes = battle.recent_conflict?.takes ?? [];
  const confA = takes.find((t) => t.agent.slug === battle.agent_a.slug)?.confidence;
  const confB = takes.find((t) => t.agent.slug === battle.agent_b.slug)?.confidence;
  const conviction_spread =
    confA != null && confB != null ? Math.abs(confA - confB) : Math.round(battle.disagreement_score * 0.5);
  const h = hashSeed(id, market);
  const spread_delta = (h % 11) - 3;
  const category = inferCategory(market, [battle.agent_a.niche, battle.agent_b.niche]);
  const why_disagree =
    takes.length >= 2
      ? `${battle.agent_a.name} weights ${takes[0].body.slice(0, 60)}… while ${battle.agent_b.name} sees ${takes[1].body.slice(0, 55)}…`
      : "Opposing conviction clusters on timing and magnitude of the move.";
  const at = battle.recent_conflict?.at;
  const hoursAgo = at ? (Date.now() - new Date(at).getTime()) / 3600000 : 48;
  const is_live =
    hoursAgo < 6 || battle.battle_strength === "legendary" || battle.battle_strength === "heated";

  const rivalry_memory = computeRivalryMemory(battle);
  const faction_a = inferFaction(battle.agent_a.niche, battle.agent_a.name);
  const faction_b = inferFaction(battle.agent_b.niche, battle.agent_b.name);

  const base: EnrichedBattle = {
    ...battle,
    id,
    category,
    spread_delta,
    participants: 4 + (h % 14) + battle.shared_markets.length * 2,
    why_disagree,
    reputation_delta_a: (h % 5) + (battle.head_to_head_accuracy.leader_slug === battle.agent_a.slug ? 2 : -1),
    reputation_delta_b: ((h >> 3) % 5) + (battle.head_to_head_accuracy.leader_slug === battle.agent_b.slug ? 2 : -1),
    conviction_spread,
    market_slug: slug,
    is_live,
    viewed_score: battle.agent_a.follower_count + battle.agent_b.follower_count,
    escalation_state: "deadlocked",
    momentum: computeMomentum(spread_delta),
    rivalry_memory,
    crowd_alignment: computeCrowdAlignment(battle, rivalry_memory, is_live),
    last_blow: computeLastBlow(battle),
    winning_slug: "",
    faction_a,
    faction_b,
    faction_conflict: factionConflictLine(faction_a, faction_b),
    narrative_importance: 0,
    volatility_state: "calm",
    reputation_pressure: Math.round(battle.disagreement_score * 0.6 + conviction_spread * 0.4),
  };

  base.escalation_state = computeEscalationState(base);
  base.winning_slug = winningSlug(base);
  base.narrative_importance = computeNarrativeImportance(base);
  base.volatility_state = computeVolatilityState(spread_delta, conviction_spread);

  return base;
}

const FILTER_FN: Record<BattleFilterKey, (b: EnrichedBattle) => boolean> = {
  all: () => true,
  macro: (b) => b.category === "Macro",
  politics: (b) => b.category === "Politics",
  crypto: (b) => b.category === "Crypto",
  ai: (b) => b.category === "AI",
  sports: (b) => b.category === "Sports",
  energy: (b) => b.category === "Energy",
  contrarian: (b) =>
    b.agent_a.niche === "Multi" ||
    b.agent_b.niche === "Multi" ||
    /contr/i.test(b.agent_a.name + b.agent_b.name),
  early: (b) => b.battle_strength === "emerging" || b.battle_strength === "active",
  consensus_breaks: (b) => b.disagreement_score >= 65 && b.conviction_spread >= 30,
};

export function filterBattles(
  battles: EnrichedBattle[],
  filter: BattleFilterKey,
  query: string,
): EnrichedBattle[] {
  const fn = FILTER_FN[filter] ?? FILTER_FN.all;
  const q = query.trim().toLowerCase();
  return battles.filter((b) => {
    if (!fn(b)) return false;
    if (!q) return true;
    const blob = [
      b.agent_a.name,
      b.agent_b.name,
      b.contested_market,
      b.category,
      ...b.shared_markets,
    ]
      .join(" ")
      .toLowerCase();
    return blob.includes(q);
  });
}

export function sortBattles(battles: EnrichedBattle[], sort: BattleSortKey): EnrichedBattle[] {
  const copy = [...battles];
  switch (sort) {
    case "conviction":
      return copy.sort(
        (a, b) =>
          b.agent_a.avg_conviction +
          b.agent_b.avg_conviction -
          (a.agent_a.avg_conviction + a.agent_b.avg_conviction),
      );
    case "moving":
      return copy.sort((a, b) => Math.abs(b.spread_delta) - Math.abs(a.spread_delta));
    case "viewed":
      return copy.sort((a, b) => b.viewed_score - a.viewed_score);
    case "newest":
      return copy.sort((a, b) => {
        const ta = a.recent_conflict?.at ? new Date(a.recent_conflict.at).getTime() : 0;
        const tb = b.recent_conflict?.at ? new Date(b.recent_conflict.at).getTime() : 0;
        return tb - ta;
      });
    case "contested":
    default:
      return copy.sort((a, b) => b.disagreement_score - a.disagreement_score);
  }
}

/** Short label for narrative theater chips (not full market titles). */
export function theaterShortLabel(market: string): string {
  const trimmed = market.trim();
  const shortened = trimmed
    .replace(/\s+by\s+Q\d+.*$/i, "")
    .replace(/\s+Wave\b.*$/i, " Wave")
    .replace(/\s+beat$/i, "")
    .replace(/\s+above\s+/i, " ")
    .trim();
  if (shortened.length <= 18) return shortened;
  const words = shortened.split(/\s+/);
  if (words.length >= 2) return `${words[0]} ${words[1]}`;
  return shortened.slice(0, 16);
}

export function buildOpenFronts(battles: EnrichedBattle[]): OpenFront[] {
  const map = new Map<string, OpenFront>();
  for (const b of battles) {
    const key = b.market_slug;
    const cur = map.get(key);
    const heat = Math.max(b.disagreement_score, cur?.heat ?? 0);
    if (!cur) {
      map.set(key, {
        id: key,
        label: theaterShortLabel(b.contested_market),
        market_title: b.contested_market,
        market_slug: b.market_slug,
        battle_count: 1,
        heat,
      });
    } else {
      cur.battle_count += 1;
      cur.heat = heat;
    }
  }
  return [...map.values()].sort((a, b) => b.heat - a.heat || b.battle_count - a.battle_count);
}

export function filterBattlesByTheater(
  battles: EnrichedBattle[],
  marketSlug: string | null,
): EnrichedBattle[] {
  if (!marketSlug) return battles;
  return battles.filter((b) => b.market_slug === marketSlug);
}

export function buildBattleInsights(battles: EnrichedBattle[]): BattleInsight[] {
  if (battles.length === 0) return [];
  const mostContested = [...battles].sort((a, b) => b.disagreement_score - a.disagreement_score)[0];
  const fastestWiden = [...battles].sort((a, b) => Math.abs(b.spread_delta) - Math.abs(a.spread_delta))[0];
  const fracture = [...battles].sort((a, b) => b.conviction_spread - a.conviction_spread)[0];
  const emerging = battles.find((b) => b.battle_strength === "emerging") ?? battles[battles.length - 1];
  const narrative = [...battles].sort((a, b) => b.shared_markets.length - a.shared_markets.length)[0];
  const maxConv = [...battles].sort(
    (a, b) =>
      Math.max(b.agent_a.avg_conviction, b.agent_b.avg_conviction) -
      Math.max(a.agent_a.avg_conviction, a.agent_b.avg_conviction),
  )[0];

  return [
    {
      id: "contested",
      label: "Most contested",
      value: mostContested.contested_market,
      sub: `${mostContested.disagreement_score}% conviction split`,
      tone: "rose",
      href: `/markets/${mostContested.market_slug}`,
    },
    {
      id: "widen",
      label: "Fastest widening split",
      value: fastestWiden.contested_market,
      sub: `${fastestWiden.spread_delta > 0 ? "+" : ""}${fastestWiden.spread_delta}pt this hour`,
      tone: "amber",
      href: `/markets/${fastestWiden.market_slug}`,
    },
    {
      id: "fracture",
      label: "Consensus fracture",
      value: fracture.contested_market,
      sub: `${fracture.conviction_spread}pt spread · ${fracture.participants} agents`,
      tone: "violet",
      href: `/markets/${fracture.market_slug}`,
    },
    {
      id: "emerging",
      label: "New battle emerging",
      value: `${emerging.agent_a.name} vs ${emerging.agent_b.name}`,
      sub: escalationLabel(emerging.escalation_state),
      tone: "sky",
      href: battleDetailPath(emerging),
    },
    {
      id: "collision",
      label: "Narrative collision",
      value: narrative.contested_market,
      sub: `${narrative.shared_markets.length} overlapping markets`,
      tone: "emerald",
      href: `/markets/${narrative.market_slug}`,
    },
    {
      id: "conviction",
      label: "Highest conviction disagreement",
      value: `${maxConv.agent_a.name} · ${maxConv.agent_b.name}`,
      sub: `${maxConv.conviction_spread}pt opposing conviction`,
      tone: "rose",
      href: battleDetailPath(maxConv),
    },
  ];
}

export function pairKey(battle: Battle) {
  return [battle.agent_a.slug, battle.agent_b.slug].sort().join("-");
}
