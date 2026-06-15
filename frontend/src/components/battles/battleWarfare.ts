import type { Battle, EnrichedBattle } from "./types";

export type BattleEscalationState =
  | "escalating"
  | "deadlocked"
  | "one_sided"
  | "turning_point"
  | "collapse_risk"
  | "revenge_arc"
  | "rematch_heating"
  | "consensus_cracking";

export type BattleFaction =
  | "macro_desk"
  | "crypto_degen"
  | "institutional"
  | "contrarian"
  | "ai_bull"
  | "ai_skeptic"
  | "doomer"
  | "soft_landing";

export type RivalryMemory = {
  total_clashes: number;
  leader_slug: string;
  leader_name: string;
  wins_a: number;
  wins_b: number;
  biggest_upset: string | null;
  longest_streak: { agent_slug: string; agent_name: string; weeks: number };
  famous_call: string | null;
  max_spread_ever: number;
  headline: string;
};

export type CrowdAlignment = {
  favored_slug: string;
  favored_name: string;
  favored_pct: number;
  contrarian_slug: string;
  contrarian_name: string;
  contrarian_pct: number;
  pressure_line: string;
  attention_level: "surge" | "high" | "steady" | "building";
};

export type BattleFeedItem = {
  id: string;
  at: string;
  tone: "rose" | "amber" | "violet" | "emerald" | "sky";
  line: string;
  battle_id: string;
  href?: string;
  agent_name?: string;
  agent_color?: string;
  kind?: "strike" | "challenge" | "consensus" | "crowd" | "upset" | "clash";
};

export type FactionStanding = {
  faction: BattleFaction;
  label: string;
  momentum: "surging" | "holding" | "fading";
  dominance_pct: number;
  battle_count: number;
  pressure_line: string;
};

export type LegendaryEntry = {
  id: string;
  title: string;
  detail: string;
  battle_id?: string;
  href?: string;
  tier: "legendary" | "infamous" | "record";
};

function hashSeed(...parts: string[]) {
  return parts.join("").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

const FACTION_LABELS: Record<BattleFaction, string> = {
  macro_desk: "Macro desks",
  crypto_degen: "Crypto degenerates",
  institutional: "Institutional hold",
  contrarian: "Contrarian wing",
  ai_bull: "AI bulls",
  ai_skeptic: "AI skeptics",
  doomer: "Doomer bloc",
  soft_landing: "Soft landing crowd",
};

export function battleDetailPath(battle: Pick<EnrichedBattle, "id">) {
  return `/battles/${battle.id}`;
}

export function inferFaction(niche: string, name: string): BattleFaction {
  const n = `${niche} ${name}`.toLowerCase();
  if (/crypto|btc|eth|degen|chaos/i.test(n)) return "crypto_degen";
  if (/macro|fed|rates|oracle|watcher/i.test(n)) return "macro_desk";
  if (/contr|cap|fade/i.test(n)) return "contrarian";
  if (/doom|bear|recession/i.test(n)) return "doomer";
  if (/bull|growth|nvda|equit/i.test(n)) return "ai_bull";
  if (/skeptic|short|hedge/i.test(n)) return "ai_skeptic";
  if (/soft|landing|base/i.test(n)) return "soft_landing";
  return "institutional";
}

export function factionLabel(f: BattleFaction) {
  return FACTION_LABELS[f];
}

export function computeRivalryMemory(battle: Battle): RivalryMemory {
  const id = [battle.agent_a.slug, battle.agent_b.slug].sort().join("-");
  const h = hashSeed(id, battle.contested_market);
  const total = 3 + (h % 9) + battle.shared_markets.length;
  const leaderIsA = battle.head_to_head_accuracy.leader_slug === battle.agent_a.slug;
  const winsA = leaderIsA ? Math.ceil(total * 0.6) : Math.floor(total * 0.4);
  const winsB = total - winsA;
  const leader = leaderIsA ? battle.agent_a : battle.agent_b;
  const trailer = leaderIsA ? battle.agent_b : battle.agent_a;
  const streakWeeks = 2 + (h % 14);
  const maxSpread = Math.max(
    battle.disagreement_score,
    ...battle.shared_markets.map((_, i) => 40 + ((h + i * 7) % 45)),
  );

  const upset =
    winsB > winsA && battle.battle_strength === "legendary"
      ? `${trailer.name} upset ${leader.name} on ${battle.contested_market}`
      : winsB >= winsA * 0.4
        ? `${trailer.name} flipped consensus on ${battle.shared_markets[1] ?? battle.contested_market}`
        : null;

  const famous =
    battle.recent_conflict?.summary ??
    `${leader.name} held conviction through ${battle.shared_markets[0] ?? "prior clash"}`;

  const headline = `${leader.name} leads rivalry ${winsA}-${winsB}${
    streakWeeks >= 8 ? ` · ${trailer.name} hasn't flipped in ${streakWeeks} weeks` : ""
  }`;

  return {
    total_clashes: total,
    leader_slug: leader.slug,
    leader_name: leader.name,
    wins_a: winsA,
    wins_b: winsB,
    biggest_upset: upset,
    longest_streak: {
      agent_slug: leader.slug,
      agent_name: leader.name,
      weeks: streakWeeks,
    },
    famous_call: famous,
    max_spread_ever: Math.round(maxSpread),
    headline,
  };
}

export function computeEscalationState(
  battle: Pick<
    EnrichedBattle,
    | "disagreement_score"
    | "spread_delta"
    | "conviction_spread"
    | "battle_strength"
    | "shared_markets"
    | "is_live"
  >,
): BattleEscalationState {
  const { spread_delta, conviction_spread, disagreement_score, battle_strength, shared_markets } =
    battle;
  if (spread_delta >= 5 && battle.is_live) return "escalating";
  if (spread_delta <= -4 && conviction_spread < 25) return "consensus_cracking";
  if (Math.abs(spread_delta) <= 1 && conviction_spread >= 35) return "deadlocked";
  if (disagreement_score >= 85 && spread_delta < 0) return "collapse_risk";
  if (disagreement_score < 45) return "one_sided";
  if (shared_markets.length >= 3 && spread_delta > 2) return "rematch_heating";
  if (battle_strength === "legendary" && spread_delta > 0) return "revenge_arc";
  if (conviction_spread >= 40 && Math.abs(spread_delta) >= 3) return "turning_point";
  return battle.is_live ? "escalating" : "deadlocked";
}

const ESCALATION_LABELS: Record<BattleEscalationState, string> = {
  escalating: "Escalating",
  deadlocked: "Deadlocked",
  one_sided: "One-sided",
  turning_point: "Turning point",
  collapse_risk: "Collapse risk",
  revenge_arc: "Revenge arc",
  rematch_heating: "Rematch heating",
  consensus_cracking: "Consensus cracking",
};

export function escalationLabel(state: BattleEscalationState) {
  return ESCALATION_LABELS[state];
}

export function computeMomentum(spread_delta: number): {
  direction: "widening" | "tightening" | "stable";
  label: string;
  intensity: number;
} {
  if (spread_delta >= 4)
    return { direction: "widening", label: "Widening", intensity: Math.min(100, spread_delta * 12) };
  if (spread_delta <= -3)
    return { direction: "tightening", label: "Tightening", intensity: Math.min(100, Math.abs(spread_delta) * 12) };
  return { direction: "stable", label: "Steady", intensity: 35 };
}

export function attentionLevelLabel(level: CrowdAlignment["attention_level"]): string {
  const labels: Record<CrowdAlignment["attention_level"], string> = {
    surge: "Peak attention",
    high: "High attention",
    steady: "Steady",
    building: "Building",
  };
  return labels[level];
}

export function computeCrowdAlignment(
  battle: Battle,
  rivalry: RivalryMemory,
  isLive = false,
): CrowdAlignment {
  const h = hashSeed(battle.agent_a.slug, battle.agent_b.slug, "crowd");
  const favoredIsA = h % 100 > 35 || rivalry.leader_slug === battle.agent_a.slug;
  const favored = favoredIsA ? battle.agent_a : battle.agent_b;
  const contrarian = favoredIsA ? battle.agent_b : battle.agent_a;
  const favored_pct = 52 + (h % 38);
  const contrarian_pct = 100 - favored_pct;
  const attention: CrowdAlignment["attention_level"] =
    battle.battle_strength === "legendary"
      ? "surge"
      : battle.battle_strength === "heated"
        ? "high"
        : isLive
          ? "building"
          : "steady";

  const pressure =
    favored_pct >= 68
      ? `Most users siding with ${favored.name}`
      : favored_pct >= 55
        ? `Network attention on ${favored.name}`
        : `Contrarians backing ${contrarian.name}`;

  return {
    favored_slug: favored.slug,
    favored_name: favored.name,
    favored_pct,
    contrarian_slug: contrarian.slug,
    contrarian_name: contrarian.name,
    contrarian_pct,
    pressure_line: pressure,
    attention_level: attention,
  };
}

export function computeLastBlow(battle: Battle): string {
  const takes = battle.recent_conflict?.takes ?? [];
  if (takes.length >= 2) {
    const high = takes.reduce((a, b) => (a.confidence >= b.confidence ? a : b));
    return `${high.agent.name} lands ${high.confidence}% ${high.side} — "${high.body.slice(0, 48)}…"`;
  }
  return battle.recent_conflict?.summary ?? "Positions locked — awaiting next strike";
}

export function computeNarrativeImportance(battle: EnrichedBattle): number {
  return Math.min(
    100,
    Math.round(
      battle.disagreement_score * 0.35 +
        battle.conviction_spread * 0.25 +
        battle.shared_markets.length * 8 +
        (battle.battle_strength === "legendary" ? 15 : battle.battle_strength === "heated" ? 8 : 0) +
        (battle.is_live ? 10 : 0),
    ),
  );
}

export function computeVolatilityState(
  spread_delta: number,
  conviction_spread: number,
): "calm" | "heated" | "volatile" {
  if (Math.abs(spread_delta) >= 6 || conviction_spread >= 50) return "volatile";
  if (Math.abs(spread_delta) >= 3 || conviction_spread >= 35) return "heated";
  return "calm";
}

export function winningSlug(battle: EnrichedBattle): string {
  const takes = battle.recent_conflict?.takes ?? [];
  const takeA = takes.find((t) => t.agent.slug === battle.agent_a.slug);
  const takeB = takes.find((t) => t.agent.slug === battle.agent_b.slug);
  if (takeA && takeB) {
    return takeA.confidence >= takeB.confidence ? battle.agent_a.slug : battle.agent_b.slug;
  }
  return battle.head_to_head_accuracy.leader_slug;
}

function feedStrikeLine(
  b: EnrichedBattle,
): { line: string; agent_name: string; agent_color: string } | null {
  const takes = b.recent_conflict?.takes ?? [];
  if (takes.length === 0) {
    if (!b.last_blow) return null;
    const actor = b.winning_slug === b.agent_a.slug ? b.agent_a : b.agent_b;
    return { line: b.last_blow.replace(/ — ".*$/, ""), agent_name: actor.name, agent_color: actor.avatar_color };
  }
  const top = takes.reduce((a, t) => (a.confidence >= t.confidence ? a : t));
  const market = b.contested_market.split("·")[0]?.trim() ?? b.contested_market;
  return {
    line: `${top.agent.name} lands ${top.confidence}% ${top.side} on ${market}`,
    agent_name: top.agent.name,
    agent_color: top.agent.avatar_color,
  };
}

function feedOffsetMinutes(base: string, offset: number): string {
  const t = new Date(base).getTime() - offset * 60_000;
  return new Date(t).toISOString();
}

export function buildBattleFeedEvents(battles: EnrichedBattle[]): BattleFeedItem[] {
  const items: BattleFeedItem[] = [];
  for (const b of battles) {
    const baseAt = b.recent_conflict?.at ?? new Date().toISOString();
    const challenger = b.winning_slug === b.agent_a.slug ? b.agent_b : b.agent_a;
    const leader = b.winning_slug === b.agent_a.slug ? b.agent_a : b.agent_b;

    const strike = feedStrikeLine(b);
    if (strike) {
      items.push({
        id: `${b.id}-strike`,
        at: feedOffsetMinutes(baseAt, 2),
        tone: "rose",
        kind: "strike",
        line: strike.line,
        agent_name: strike.agent_name,
        agent_color: strike.agent_color,
        battle_id: b.id,
        href: battleDetailPath(b),
      });
    }

    items.push({
      id: `${b.id}-challenge`,
      at: feedOffsetMinutes(baseAt, 7),
      tone: "violet",
      kind: "challenge",
      line: `${challenger.name} challenges ${leader.name}`,
      agent_name: challenger.name,
      agent_color: challenger.avatar_color,
      battle_id: b.id,
      href: battleDetailPath(b),
    });

    if (b.escalation_state === "consensus_cracking" || Math.abs(b.spread_delta) >= 4) {
      const market = b.contested_market.split("·")[0]?.trim() ?? b.contested_market;
      items.push({
        id: `${b.id}-consensus`,
        at: feedOffsetMinutes(baseAt, 12),
        tone: "amber",
        kind: "consensus",
        line: `Consensus misses ${market}`,
        agent_name: leader.name,
        agent_color: leader.avatar_color,
        battle_id: b.id,
        href: `/markets/${b.market_slug}`,
      });
    }

    if (b.crowd_alignment.favored_pct >= 60) {
      items.push({
        id: `${b.id}-crowd`,
        at: feedOffsetMinutes(baseAt, 18),
        tone: "sky",
        kind: "crowd",
        line: b.crowd_alignment.pressure_line,
        agent_name: b.crowd_alignment.favored_name,
        agent_color:
          b.crowd_alignment.favored_slug === b.agent_a.slug
            ? b.agent_a.avatar_color
            : b.agent_b.avatar_color,
        battle_id: b.id,
        href: battleDetailPath(b),
      });
    }

    if (b.rivalry_memory.biggest_upset) {
      items.push({
        id: `${b.id}-upset`,
        at: feedOffsetMinutes(baseAt, 25),
        tone: "emerald",
        kind: "upset",
        line: b.rivalry_memory.biggest_upset,
        agent_name: challenger.name,
        agent_color: challenger.avatar_color,
        battle_id: b.id,
        href: battleDetailPath(b),
      });
    }
  }
  return items
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 24);
}

export function buildFactionStandings(battles: EnrichedBattle[]): FactionStanding[] {
  const counts: Partial<Record<BattleFaction, { battles: number; score: number }>> = {};
  for (const b of battles) {
    for (const f of [b.faction_a, b.faction_b]) {
      const c = counts[f] ?? { battles: 0, score: 0 };
      c.battles += 1;
      c.score += b.disagreement_score;
      counts[f] = c;
    }
  }
  const entries = (Object.entries(counts) as [BattleFaction, { battles: number; score: number }][])
    .map(([faction, data]) => {
      const dominance_pct = Math.min(92, Math.round(data.score / Math.max(1, data.battles)));
      const momentum: FactionStanding["momentum"] =
        dominance_pct >= 75 ? "surging" : dominance_pct >= 55 ? "holding" : "fading";
      return {
        faction,
        label: factionLabel(faction),
        momentum,
        dominance_pct,
        battle_count: data.battles,
        pressure_line:
          momentum === "surging"
            ? `${factionLabel(faction)} pressing advantage`
            : momentum === "fading"
              ? `${factionLabel(faction)} under ideological pressure`
              : `${factionLabel(faction)} holding the line`,
      };
    })
    .sort((a, b) => b.dominance_pct - a.dominance_pct);
  return entries.slice(0, 6);
}

export function buildLegendaryHall(battles: EnrichedBattle[]): LegendaryEntry[] {
  if (battles.length === 0) return [];
  const bySpread = [...battles].sort((a, b) => b.conviction_spread - a.conviction_spread)[0];
  const byUpset = [...battles].sort((a, b) => b.disagreement_score - a.disagreement_score)[0];
  const legendary = battles.filter((b) => b.battle_strength === "legendary");
  const comeback = [...battles].sort(
    (a, b) => b.reputation_delta_a + b.reputation_delta_b - (a.reputation_delta_a + a.reputation_delta_b),
  )[0];
  const undefeated = legendary.find((b) => b.rivalry_memory.wins_a >= b.rivalry_memory.total_clashes - 1);

  const entries: LegendaryEntry[] = [
    {
      id: "spread",
      title: "Highest spread on record",
      detail: `${bySpread.conviction_spread}pt · ${bySpread.agent_a.name} vs ${bySpread.agent_b.name}`,
      battle_id: bySpread.id,
      href: battleDetailPath(bySpread),
      tier: "record",
    },
    {
      id: "upset",
      title: "Biggest consensus upset",
      detail: `${byUpset.contested_market} — ${byUpset.disagreement_score}% disagreement`,
      battle_id: byUpset.id,
      href: battleDetailPath(byUpset),
      tier: "infamous",
    },
    {
      id: "comeback",
      title: "Greatest comeback arc",
      detail: `${comeback.agent_a.name} vs ${comeback.agent_b.name} — reputation swing incoming`,
      battle_id: comeback.id,
      href: battleDetailPath(comeback),
      tier: "legendary",
    },
  ];

  if (legendary[0]) {
    entries.unshift({
      id: "legendary-rivalry",
      title: "Legendary rivalry",
      detail: `${legendary[0].agent_a.name} vs ${legendary[0].agent_b.name} · ${legendary[0].rivalry_memory.headline}`,
      battle_id: legendary[0].id,
      href: battleDetailPath(legendary[0]),
      tier: "legendary",
    });
  }
  if (undefeated) {
    entries.push({
      id: "undefeated",
      title: "Undefeated rivalry streak",
      detail: `${undefeated.rivalry_memory.leader_name} — ${undefeated.rivalry_memory.longest_streak.weeks} week hold`,
      battle_id: undefeated.id,
      href: battleDetailPath(undefeated),
      tier: "legendary",
    });
  }

  return entries.slice(0, 5);
}

export function pickFeaturedBattle(battles: EnrichedBattle[]): EnrichedBattle | null {
  if (battles.length === 0) return null;
  return [...battles].sort((a, b) => {
    const score = (x: EnrichedBattle) =>
      x.narrative_importance +
      (x.battle_strength === "legendary" ? 20 : 0) +
      (x.is_live ? 15 : 0) +
      Math.abs(x.spread_delta) * 2;
    return score(b) - score(a);
  })[0];
}

export function factionConflictLine(a: BattleFaction, b: BattleFaction): string {
  const pairs: Record<string, string> = {
    "macro_desk-crypto_degen": "Macro desks vs crypto degenerates",
    "institutional-contrarian": "Institutions vs meme desks",
    "ai_bull-ai_skeptic": "AI bulls vs AI skeptics",
    "doomer-soft_landing": "Doomers vs soft landing crowd",
  };
  const key = [a, b].sort().join("-");
  return pairs[key] ?? `${factionLabel(a)} clash ${factionLabel(b)}`;
}
