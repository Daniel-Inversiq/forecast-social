import { momentumFromSeed, rankDeltaFromSeed } from "@/components/feed/motion";

import { opponentSlugsFor } from "@/lib/agentOpponents";

import { reputationTrendToDirection } from "@/lib/reputation";

import type { Battle } from "@/components/battles/types";

import type {

  AgentArchetypeKey,

  AgentFilterKey,

  AgentHeatState,

  AgentPersonality,

  EnrichedAgent,

  ForecasterBase,

  RivalryHeatEntry,

} from "./types";

import { ARCHETYPE_META } from "./archetypeMeta";

import { resolveAgentPersonality } from "./agentPersonalityProfiles";



const NARRATIVES = [

  "Fed pivot cluster",

  "AI capex cycle",

  "Election volatility",

  "Crypto civil war on 150k",

  "Earnings dispersion",

  "Climate policy repricing",

  "Sports upset wave",

  "Recession timing split",

  "HY default wave watch",

  "Emergency cut cope vs institutional NO",

  "H100 shortage hardware bet",

  "ETF tourist exit liquidity",

];



const MARKETS = [

  "US recession by Q4",

  "Fed cut by Sep 2026",

  "BTC above 150k by year end",

  "NVDA Q2 beat",

  "Major AI breakthrough before December",

  "Champions League final upset",

  "Oil above $100",

  "US election debate winner",

  "HY default wave by Q3",

  "VIX above 35 before August",

  "Emergency Fed cut before election",

  "H100 shortage eases before Q4",

];



const RECENT_CALLS = [

  "LeverageGoblin: tourists are exit liquidity",

  "ExitLiquidity fading ETF top at 88% NO",

  "CreditSage flagged HY before spreads blew out",

  "Football Monk upset receipt at 12% implied",

  "PermaBear9000 vs BullBot on NVDA — 63pt spread",

  "RateCutCopium emergency cut cope at 88%",

  "InjuryTruthr injury cluster pre-week 1",

  "FedWatcher vs LeverageGoblin on BTC regime",

];



const LORE_TEMPLATES = [

  "Still holding {side} on {market}",

  "Returned to {narrative} thesis",

  "Third {niche} call this week — refusing to flip",

  "Doubling down despite repricing on {market}",

  "Consensus caught up; rotating before overcorrection",

  "Rare stance update after {market} print",

];



const ARC_LINES = [

  "Doubling down",

  "Consensus enemy arc",

  "Receipt hunt",

  "Rivalry escalation",

  "Timing edge run",

  "Fade crowded narrative",

  "Cult forming around the read",

];



const NETWORK_STATUS = [

  "Battling {rival}",

  "Doubling down",

  "Consensus enemy",

  "Cult forming",

  "Crowded take",

  "Contrarian breakout",

  "Cooling after receipt",

  "Heating into clash",

];



function hash(slug: string) {

  return slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0);

}



function pick<T>(arr: T[], seed: string, offset = 0): T {

  return arr[(hash(seed) + offset) % arr.length];

}



function inferPersonality(agent: ForecasterBase): AgentPersonality {

  const s = `${agent.conviction_style} ${agent.personality_tagline}`.toLowerCase();

  if (/contrarian|fade|skeptic|bearish|blunt/.test(s)) return "contrarian";

  if (/volatile|chaos|irreverent|punchy/.test(s)) return "chaos";

  if (/macro|policy|hawk|measured|calm|steady|patient/.test(s)) return "macro";

  if (/narrative|scout|curious|hunter/.test(s)) return "hunter";

  if (/data|analytical|evidence|wonk/.test(s)) return "analyst";

  return "default";

}



function inferArchetype(agent: ForecasterBase): AgentArchetypeKey {

  const s = agent.conviction_style.toLowerCase();

  if (/fade|contrarian/.test(s)) return "consensus_breaker";

  if (/macro|policy|long horizon/.test(s)) return "macro_strategist";

  if (/momentum|volatile/.test(s)) return "volatility_chaser";

  if (/evidence|data|scout/.test(s)) return "early_signal_scout";

  if (/slow|patient/.test(s)) return "slow_conviction";

  if (/high conviction/.test(s)) return "narrative_hunter";

  return "macro_strategist";

}



function buildCoreEdge(agent: ForecasterBase, archetype: AgentArchetypeKey): string {

  const niche = agent.niche.toLowerCase();

  const edges: Record<AgentArchetypeKey, string> = {

    consensus_breaker: "Fades crowded narratives before consensus reprices",

    macro_strategist: "Tracks liquidity stress before the desk agrees",

    narrative_hunter: "Rides story momentum before markets fully price it",

    volatility_chaser: "Thrives in contested spreads and fast repricing",

    early_signal_scout: "Finds injury and policy edges before repricing",

    slow_conviction: "Builds patient structural reads with receipt discipline",

  };

  if (niche === "sports" && /injury|mri|medical/.test(agent.conviction_style.toLowerCase())) {

    return "Injury cluster specialist before lines move";

  }

  if (niche === "tech" && /bear|fatalist|skeptic/.test(agent.personality_tagline.toLowerCase())) {

    return "Tracks AI overvaluation narratives with receipts";

  }

  if (niche === "macro" && /bear|doom/.test(agent.personality_tagline.toLowerCase())) {

    return "Macro doom with receipts — stress before consensus";

  }

  if (niche === "crypto" && /fade|tourist|cynical/.test(agent.conviction_style.toLowerCase())) {

    return "Fades crowded crypto narratives at the top";

  }

  return edges[archetype];

}



function buildSignatureThesis(agent: ForecasterBase, market: string, narrative: string): string {

  const h = hash(agent.slug);

  const side = h % 3 === 0 ? "NO" : "YES";

  const templates = [

    `${side} on ${market} — conviction held through repricing`,

    `Leading read on ${narrative}`,

    `${agent.niche} timing edge on ${market}`,

    `Structural ${side} while crowd disagrees`,

  ];

  return pick(templates, agent.slug, 3);

}



function buildToneLabel(agent: ForecasterBase): string {

  const parts = agent.personality_tagline.split("·").map((p) => p.trim());

  return parts.length >= 2 ? parts.join(" · ") : agent.personality_tagline;

}



function inferHeatState(

  agent: ForecasterBase,

  trend: "up" | "down" | "flat",

  rank_delta: number,

  disagreement_pct: number,

  early_on_pct: number,

  tags: string[],

  activeClashes: number,

): { state: AgentHeatState; label: string; attention: number } {

  if (agent.status === "dormant") {
    return {
      state: "dormant",
      label: agent.status_label ?? "Season break",
      attention: 12,
    };
  }

  const h = hash(agent.slug);

  const followers = agent.follower_count;

  const velocity = agent.reputation_velocity ?? 0;



  if (activeClashes >= 2 && disagreement_pct >= 55) {

    return { state: "hot", label: "Hot", attention: 88 + (h % 12) };

  }

  if (tags.includes("consensus_breakers") && disagreement_pct >= 62) {

    return { state: "consensus_enemy", label: "Consensus enemy", attention: 82 + (h % 10) };

  }

  if (trend === "up" && rank_delta >= 8) {

    return { state: "breakout", label: "Breakout", attention: 90 + (h % 8) };

  }

  if (trend === "up" && rank_delta >= 4) {

    return { state: "rising", label: "Rising", attention: 72 + (h % 15) };

  }

  if (followers >= 90 && trend === "up") {

    return { state: "cult_forming", label: "Cult forming", attention: 78 + (h % 12) };

  }

  if (100 - disagreement_pct >= 72 && followers >= 45) {

    return { state: "crowded", label: "Crowded", attention: 55 + (h % 20) };

  }

  if (followers < 20 && (reputation_score(agent) >= 78 || velocity > 0.4)) {

    return { state: "undervalued", label: "Undervalued", attention: 65 + (h % 18) };

  }

  if (trend === "down") {

    return { state: "cooling", label: "Cooling", attention: 38 + (h % 15) };

  }

  if (trend === "up") {

    return { state: "hot", label: "Hot", attention: 70 + (h % 20) };

  }

  return { state: "rising", label: "Rising", attention: 50 + (h % 25) };

}



function agreementPctFromDisagreement(disagreement_pct: number) {

  return 100 - disagreement_pct;

}



function reputation_score(agent: ForecasterBase) {

  return Math.min(

    99,

    Math.round(

      agent.reputation_score ??

        agent.accuracy_score * 0.55 + agent.streak * 2.2 + (agent.follower_count / 120) * 0.08,

    ),

  );

}



function buildWhyFollow(agent: ForecasterBase, archetype: AgentArchetypeKey, narrative: string): string {

  const niche = agent.niche.toLowerCase();

  if (archetype === "consensus_breaker") {

    return "Useful if you fade consensus — adds contrarian clash to your feed";

  }

  if (niche === "macro" || niche === "rates") {

    return "Adds early macro stress signals and rate-cut disagreement to your feed";

  }

  if (niche === "sports") {

    return "Finds sports injury edges before the market reprices";

  }

  if (niche === "tech") {

    return "Tracks AI overvaluation narratives and capex disagreement";

  }

  if (niche === "crypto") {

    return "Surfaces crypto regime fights and tourist-fade signals";

  }

  if (niche === "politics") {

    return "Adds election volatility and policy-timing disagreement";

  }

  return `Adds ${narrative.toLowerCase()} lens to your intelligence feed`;

}



function buildFeedLens(agent: ForecasterBase, narrative: string): string {

  const niche = agent.niche;

  const style = agent.conviction_style;

  return `${niche} · ${narrative.split(" ")[0] ?? "macro"} stress + ${style.toLowerCase()} takes`;

}



function buildFollowHover(agent: ForecasterBase, narrative: string): string {

  const niche = agent.niche.toLowerCase();

  if (niche === "macro" || niche === "rates") {

    return `Follow to add macro stress + rate-cut disagreement to your feed.`;

  }

  if (niche === "sports") {

    return `Follow to add injury-cluster edges + upset timing to your feed.`;

  }

  if (niche === "crypto") {

    return `Follow to add regime fights + tourist-fade signals to your feed.`;

  }

  if (niche === "tech") {

    return `Follow to add AI capex disagreement + product-cycle reads to your feed.`;

  }

  return `Follow to add ${narrative.toLowerCase()} + ${agent.conviction_style.toLowerCase()} signals to your feed.`;

}



function buildTags(agent: ForecasterBase, trend: "up" | "down" | "flat", early: number): string[] {

  const tags: string[] = [];

  if (trend === "up") tags.push("rising");

  if (early >= 72) tags.push("early");

  const s = agent.conviction_style.toLowerCase();

  if (/fade|contrarian/.test(s)) {

    tags.push("contrarian", "consensus_breakers");

  }

  const niche = agent.niche.toLowerCase();

  if (["macro", "rates", "equities", "multi"].includes(niche)) tags.push("macro");

  if (niche === "tech") tags.push("ai");

  if (niche === "politics") tags.push("politics");

  if (niche === "crypto") tags.push("crypto");

  if (niche === "sports") tags.push("sports");

  return tags;

}



function buildLore(

  agent: ForecasterBase,

  market: string,

  narrative: string,

): { lore_line: string; last_stance_line: string; recurring_behavior: string } {

  const h = hash(agent.slug);

  const side = h % 3 === 0 ? "NO" : "YES";

  const loreTpl = pick(LORE_TEMPLATES, agent.slug, 1)

    .replace("{side}", side)

    .replace("{market}", market)

    .replace("{narrative}", narrative)

    .replace("{niche}", agent.niche.toLowerCase());



  const stances = [

    `Still holding ${side} on ${market}`,

    `Returned to ${narrative} thesis`,

    `Refuses to flip despite repricing`,

    `Third ${agent.niche.toLowerCase()} call this week`,

  ];



  const behaviors = [

    "Rarely flips before receipt",

    "Escalates rivalries instead of hedging",

    "Enters before consensus forms",

    "Holds NO through squeeze attempts",

    "Posts follow-ups within 24h of clash",

  ];



  return {

    lore_line: loreTpl,

    last_stance_line: pick(stances, agent.slug, 2),

    recurring_behavior: pick(behaviors, agent.slug, 4),

  };

}



function resolveRival(

  agent: ForecasterBase,

  nameBySlug: Map<string, string>,

  battleBySlug: Map<string, { rivalSlug: string; spread: number; status: string }>,

): {

  primary_rival_slug: string | null;

  primary_rival_name: string | null;

  rivalry_spread: number;

  active_clashes: number;

  battle_status: string | null;

  rival_record: string | null;

} {

  const h = hash(agent.slug);

  const battle = battleBySlug.get(agent.slug);

  const opponents = opponentSlugsFor(agent.slug);

  const rivalSlug = battle?.rivalSlug ?? opponents[0] ?? opponents[h % Math.max(1, opponents.length)] ?? null;

  const rivalName = rivalSlug ? nameBySlug.get(rivalSlug) ?? rivalSlug : null;

  const spread = battle?.spread ?? 18 + (h % 28);

  const active_clashes = battle ? 1 + (h % 3) : 1 + (h % 2);

  const battle_status = battle?.status ?? (rivalName ? `Battling ${rivalName}` : null);

  const wonYesterday = (h + new Date().getDate()) % 4 === 0;

  const rival_record = rivalName

    ? wonYesterday

      ? `Beat ${rivalName.split(" ")[0]} yesterday`

      : `vs ${rivalName} · ${spread}pt spread`

    : null;



  return {

    primary_rival_slug: rivalSlug,

    primary_rival_name: rivalName,

    rivalry_spread: spread,

    active_clashes,

    battle_status,

    rival_record,

  };

}



function buildNetworkStatus(

  rivalName: string | null,

  battleStatus: string | null,

  heatLabel: string,

  slug: string,

): string {

  if (battleStatus) return battleStatus;

  if (rivalName) {

    return pick(NETWORK_STATUS, slug, 0).replace("{rival}", rivalName);

  }

  if (heatLabel === "Cult forming") return "Cult forming";

  if (heatLabel === "Consensus enemy") return "Consensus enemy";

  if (heatLabel === "Breakout") return "Contrarian breakout";

  if (heatLabel === "Crowded") return "Crowded";

  return pick(ARC_LINES, slug, 2);

}



export function enrichAgent(

  agent: ForecasterBase,

  ctx?: {

    nameBySlug?: Map<string, string>;

    battleBySlug?: Map<string, { rivalSlug: string; spread: number; status: string }>;

  },

): EnrichedAgent {

  const h = hash(agent.slug);

  const trend = agent.reputation_trend

    ? reputationTrendToDirection(agent.reputation_trend)

    : momentumFromSeed(agent.slug);

  const seedDelta = rankDeltaFromSeed(agent.slug);

  const rank_delta =

    agent.reputation_delta != null

      ? Math.round(agent.reputation_delta)

      : trend === "up"

        ? seedDelta

        : trend === "down"

          ? -seedDelta

          : 0;

  const repScore = reputation_score(agent);

  const early_on_pct =

    agent.timing_quality != null ? Math.round(Math.min(99, agent.timing_quality)) : 42 + (h % 48);

  const agreement_pct = 28 + (h % 52);

  const disagreement_pct = 100 - agreement_pct;

  const personality = inferPersonality(agent);

  const archetype = inferArchetype(agent);

  const strongest_market = pick(MARKETS, agent.slug);

  const strongest_narrative = pick(NARRATIVES, agent.slug, 2);

  const tags = buildTags(agent, trend, early_on_pct);



  const nameBySlug = ctx?.nameBySlug ?? new Map([[agent.slug, agent.name]]);

  const battleBySlug = ctx?.battleBySlug ?? new Map();

  const rivalry = resolveRival(agent, nameBySlug, battleBySlug);

  const heat = inferHeatState(

    agent,

    trend,

    rank_delta,

    disagreement_pct,

    early_on_pct,

    tags,

    rivalry.active_clashes,

  );

  const lore = buildLore(agent, strongest_market, strongest_narrative);

  const archetypeMeta = ARCHETYPE_META[archetype];

  const personalityProfile = resolveAgentPersonality(agent);



  return {

    ...agent,

    reputation_score: repScore,

    trend,

    rank_delta,

    personality,

    archetype,

    strongest_market,

    strongest_narrative,

    recent_call: pick(RECENT_CALLS, agent.slug, 4),

    agreement_pct,

    disagreement_pct,

    receipts_count: agent.verified_calls ?? Math.min(8, 3 + (h % 6)),

    early_on_pct,

    tags,

    momentum_glow: trend === "up" ? 0.7 + (h % 30) / 100 : trend === "down" ? 0.25 : 0.45,

    archetype_label: archetypeMeta.title,

    core_edge: buildCoreEdge(agent, archetype),

    signature_thesis: buildSignatureThesis(agent, strongest_market, strongest_narrative),

    tone_label: buildToneLabel(agent),

    niche_badge: personalityProfile.niche_badge,

    personality_quote: personalityProfile.personality_quote,

    recent_take: personalityProfile.recent_take,

    heat_state: heat.state,

    heat_label: heat.label,

    attention_score: heat.attention,

    network_status:
      agent.status === "dormant"
        ? (agent.status_label ?? "Season break")
        : buildNetworkStatus(
            rivalry.primary_rival_name,
            rivalry.battle_status,
            heat.label,
            agent.slug,
          ),

    current_arc: pick(ARC_LINES, agent.slug, 1),

    ...lore,

    ...rivalry,

    why_follow: buildWhyFollow(agent, archetype, strongest_narrative),

    feed_lens: buildFeedLens(agent, strongest_narrative),

    follow_hover: buildFollowHover(agent, strongest_narrative),

    signal_types: [agent.niche, archetypeMeta.tone, agent.conviction_style.split(" ")[0] ?? "conviction"],

  };

}



export function buildEnrichmentContext(agents: ForecasterBase[], battles: Battle[] = []) {

  const nameBySlug = new Map(agents.map((a) => [a.slug, a.name]));

  const battleBySlug = new Map<string, { rivalSlug: string; spread: number; status: string }>();



  for (const b of battles) {

    const spread = Math.round(b.disagreement_score ?? 20);

    const status =

      b.battle_strength === "heated" || b.battle_strength === "legendary"

        ? `Battling ${b.agent_b.name}`

        : `Clash on ${b.contested_market ?? "market"}`;

    battleBySlug.set(b.agent_a.slug, {

      rivalSlug: b.agent_b.slug,

      spread,

      status: `Battling ${b.agent_b.name}`,

    });

    battleBySlug.set(b.agent_b.slug, {

      rivalSlug: b.agent_a.slug,

      spread,

      status: `Battling ${b.agent_a.name}`,

    });

  }



  return { nameBySlug, battleBySlug };

}



export function enrichAgents(agents: ForecasterBase[], battles: Battle[] = []): EnrichedAgent[] {

  const ctx = buildEnrichmentContext(agents, battles);

  return agents.map((a) => enrichAgent(a, ctx));

}



export function buildRivalryHeatList(agents: EnrichedAgent[]): RivalryHeatEntry[] {

  return agents

    .filter((a) => a.primary_rival_slug && a.rivalry_spread >= 20)

    .map((a) => ({

      agent_slug: a.slug,

      agent_name: a.name,

      rival_slug: a.primary_rival_slug!,

      rival_name: a.primary_rival_name ?? a.primary_rival_slug!,

      spread: a.rivalry_spread,

      status: a.battle_status ?? `vs ${a.primary_rival_name}`,

      heat: a.attention_score + a.active_clashes * 4,

    }))

    .sort((a, b) => b.heat - a.heat)

    .slice(0, 8);

}



const NICHE_BY_FILTER: Partial<Record<AgentFilterKey, string[]>> = {

  macro: ["Macro", "Rates", "Equities", "Multi"],

  sports: ["Sports"],

  politics: ["Politics"],

  crypto: ["Crypto"],

  ai: ["Tech"],

};



export function filterAgents(

  agents: EnrichedAgent[],

  filter: AgentFilterKey,

  query: string,

  similarToSlugs: Set<string>,

  similarMode: boolean,

): EnrichedAgent[] {

  let list = agents;



  if (similarMode && similarToSlugs.size > 0) {

    const followed = agents.filter((a) => similarToSlugs.has(a.slug));

    const niches = new Set(followed.map((a) => a.niche));

    const styles = new Set(followed.map((a) => a.conviction_style));

    list = agents.filter(

      (a) =>

        !similarToSlugs.has(a.slug) &&

        (niches.has(a.niche) || [...styles].some((s) => a.conviction_style === s)),

    );

  }



  if (filter !== "all") {

    if (filter in NICHE_BY_FILTER) {

      const niches = NICHE_BY_FILTER[filter as keyof typeof NICHE_BY_FILTER] ?? [];

      list = list.filter((a) => niches.includes(a.niche));

    } else {

      list = list.filter((a) => a.tags.includes(filter));

    }

  }



  const q = query.trim().toLowerCase();

  if (q) {

    list = list.filter(

      (a) =>

        a.name.toLowerCase().includes(q) ||

        a.slug.includes(q) ||

        a.niche.toLowerCase().includes(q) ||

        a.strongest_narrative.toLowerCase().includes(q) ||

        a.core_edge.toLowerCase().includes(q) ||

        a.personality_quote.toLowerCase().includes(q) ||

        a.recent_take.toLowerCase().includes(q) ||

        a.niche_badge.toLowerCase().includes(q) ||

        a.why_follow.toLowerCase().includes(q),

    );

  }



  return list;

}



export function sortAgents(agents: EnrichedAgent[], sort: string): EnrichedAgent[] {

  const copy = [...agents];

  switch (sort) {

    case "rising":

      return copy.sort((a, b) => {

        const ta = a.trend === "up" ? 1 : a.trend === "down" ? -1 : 0;

        const tb = b.trend === "up" ? 1 : b.trend === "down" ? -1 : 0;

        if (tb !== ta) return tb - ta;

        return b.rank_delta - a.rank_delta;

      });

    case "accuracy":

      return copy.sort((a, b) => b.accuracy_score - a.accuracy_score);

    case "streak":

      return copy.sort((a, b) => b.streak - a.streak);

    case "receipts":

      return copy.sort((a, b) => b.receipts_count - a.receipts_count);

    case "early":

      return copy.sort((a, b) => b.early_on_pct - a.early_on_pct);

    default:

      return copy.sort((a, b) => b.reputation_score - a.reputation_score);

  }

}



export { ARCHETYPE_META } from "./archetypeMeta";

