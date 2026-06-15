import { syntheticMove } from "@/components/feed/shared";
import {
  matchesHorizonFilter,
  resolutionHorizon,
  type ResolutionHorizonFilterKey,
} from "@/lib/resolutionHorizon";
import { generateMarketThesis } from "@/lib/forecastThesis";
import { titleToSlug } from "@/lib/slugs";
import type {
  BattlefieldModule,
  EnrichedMarket,
  FeaturedModule,
  FeedMarketState,
  MarketBase,
  MarketFilterKey,
  MarketMemoryEntry,
  MarketSortKey,
  NarrativeCluster,
  NarrativeStateKey,
  PressureMetrics,
  SocialSignalKey,
} from "./types";

function hash(title: string) {
  return title.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

const CLUSTERS: { id: string; label: string; tone: NarrativeCluster["tone"]; match: (m: MarketBase) => boolean }[] = [
  {
    id: "ai",
    label: "AI acceleration",
    tone: "violet",
    match: (m) =>
      /ai|nvda|breakthrough|tech/i.test(m.title + m.narrative) || m.category === "Tech",
  },
  {
    id: "recession",
    label: "Recession fears",
    tone: "rose",
    match: (m) => /recession|fed|rates|labor|rent/i.test(m.title + m.narrative),
  },
  {
    id: "sports",
    label: "Sports upset cycle",
    tone: "emerald",
    match: (m) => m.category === "Sports",
  },
  {
    id: "election",
    label: "Election volatility",
    tone: "sky",
    match: (m) => /election|incumbent|debate|politic/i.test(m.title + m.narrative),
  },
  {
    id: "crypto",
    label: "Crypto breakout",
    tone: "amber",
    match: (m) => m.category === "Crypto" || /btc|crypto/i.test(m.title),
  },
  {
    id: "climate",
    label: "Climate regulation pressure",
    tone: "emerald",
    match: (m) => m.category === "Climate" || /carbon|climate/i.test(m.title),
  },
];

const AGENT_NAMES = [
  { name: "Macro Oracle", slug: "macro-oracle" },
  { name: "DoomBot", slug: "doombot" },
  { name: "BullBot", slug: "bullbot" },
  { name: "Neural Scout", slug: "neural-scout" },
  { name: "ContrCap", slug: "contr-cap" },
  { name: "ElectionBrain", slug: "election-brain" },
];

function inferCluster(m: MarketBase): string {
  for (const c of CLUSTERS) {
    if (c.match(m)) return c.label;
  }
  return "Cross-market conviction";
}

const EXTENDED_STATES: NarrativeStateKey[] = [
  "deadlocked",
  "volatility spike",
  "institutional split",
  "mania phase",
  "quiet accumulation",
];

function inferNarrativeState(m: MarketBase, h: number, move: number): NarrativeStateKey {
  if (m.status !== "open" && m.resolved_outcome) {
    return "stabilization";
  }
  if (m.urgency === "contested" && Math.abs(move) >= 4) return "panic repricing";
  if (m.urgency === "contested" && m.agent_count >= 25) return "institutional split";
  if (m.urgency === "contested") return "fragmenting";
  if (m.urgency === "hot" && move > 3) return "mania phase";
  if (m.urgency === "hot") return "volatility spike";
  if (m.urgency === "rising" && move > 2) return "contrarian breakout";
  if (m.urgency === "rising") return "consensus building";
  if (m.urgency === "cooling" && m.current_yes_probability >= 65) return "crowded";
  if (m.urgency === "cooling") return "quiet accumulation";
  if (Math.abs(move) < 1 && m.agent_count >= 15) return "deadlocked";
  return EXTENDED_STATES[h % EXTENDED_STATES.length] ?? "stabilization";
}

function applyFeedState(
  state: NarrativeStateKey,
  feedState?: FeedMarketState | null,
): NarrativeStateKey {
  const raw = feedState?.state?.toLowerCase().trim();
  if (!raw) return state;
  const normalized = raw.replace(/_/g, " ") as NarrativeStateKey;
  const valid: NarrativeStateKey[] = [
    "consensus building",
    "panic repricing",
    "fragmenting",
    "stabilization",
    "crowded",
    "contrarian breakout",
    "deadlocked",
    "volatility spike",
    "institutional split",
    "mania phase",
    "quiet accumulation",
  ];
  if (valid.includes(normalized)) return normalized;
  return state;
}

function buildPressure(m: MarketBase, h: number, disagreement_pct: number, move: number): PressureMetrics {
  const p = m.current_yes_probability;
  return {
    crowding: Math.min(98, 35 + (h % 45) + (p >= 60 || p <= 40 ? 12 : 0)),
    disagreement_spread: disagreement_pct,
    conviction_velocity: Math.min(99, 28 + Math.abs(move) * 6 + (m.urgency === "hot" ? 18 : 0)),
    reputation_imbalance: Math.min(95, 40 + (h % 40) + (m.urgency === "contested" ? 15 : 0)),
    momentum_acceleration: Math.min(99, 20 + Math.abs(move) * 8 + (m.agent_count > 20 ? 10 : 0)),
    timing_divergence: Math.min(92, 22 + (h % 35) + (m.urgency === "rising" ? 14 : 0)),
  };
}

function pressureHeadline(
  pressure: PressureMetrics,
  reputation_yes_share: number,
  state: NarrativeStateKey,
): string {
  if (state === "panic repricing") return "Repricing accelerating — consensus under attack";
  if (state === "contrarian breakout") return "Contrarians gaining ground";
  if (reputation_yes_share >= 72) return `${reputation_yes_share}% of reputation now aligned on YES`;
  if (reputation_yes_share <= 28) return `${100 - reputation_yes_share}% of reputation stacked on NO`;
  if (pressure.crowding >= 75) return "Crowded conviction — late entrants piling in";
  if (pressure.disagreement_spread >= 45) return "Network split — timing divergence widening";
  if (pressure.momentum_acceleration >= 70) return "Momentum acceleration — battle threads heating";
  return "Consensus weakening — factions testing new theses";
}

function buildAgentLeadLine(
  leading: EnrichedMarket["leading_agents"],
  m: MarketBase,
  h: number,
): { lead: string; stance?: string; holdout?: string } {
  const lead = leading[0];
  const flip = leading[1];
  const holdout = leading[2];
  if (!lead) return { lead: "Macro desks splitting" };

  const verbs = ["leads", "doubled down on", "isolated on", "defending"];
  const verb = verbs[h % verbs.length];
  let leadLine = `${lead.name} ${verb} ${lead.side}`;
  if (m.urgency === "contested" && flip && flip.side !== lead.side) {
    return {
      lead: leadLine,
      stance: flip ? `${flip.name} flipped to ${flip.side}` : undefined,
      holdout: holdout && holdout.side !== lead.side ? `${holdout.name} holdout on ${holdout.side}` : undefined,
    };
  }
  if (flip && flip.side === lead.side) {
    leadLine = `${lead.name} & ${flip.name} anchor ${lead.side}`;
  }
  return {
    lead: leadLine,
    stance: h % 4 === 0 && flip ? `${flip.name} shifted stance this week` : undefined,
    holdout:
      holdout && holdout.side !== lead.side ? `${holdout.name} isolated on ${holdout.side}` : undefined,
  };
}

function buildMarketMemory(
  m: MarketBase,
  leading: EnrichedMarket["leading_agents"],
  h: number,
  early: string,
): MarketMemoryEntry[] {
  const entries: MarketMemoryEntry[] = [];
  const weeks = 2 + (h % 8);
  entries.push({
    id: "fm",
    kind: "first_mover",
    text: `${early} first called this ${weeks} weeks ago`,
  });
  if (m.urgency === "contested" && leading[1]) {
    entries.push({
      id: "flip",
      kind: "flip",
      text: `Consensus flipped after ${leading[1].name} receipt`,
    });
  }
  if (leading[0]) {
    entries.push({
      id: "hold",
      kind: "hold",
      text: `${leading[0].name} held ${leading[0].side} through repricing`,
    });
  }
  if (m.status !== "open" && m.resolved_outcome) {
    entries.push({
      id: "settle",
      kind: "settlement",
      text: `Settled ${m.resolved_outcome} — reputation aftermath locked`,
    });
  }
  if (h % 3 === 0) {
    entries.push({
      id: "battle",
      kind: "battle",
      text: `Battle escalated when ${leading[2]?.name ?? "rival desks"} challenged timing`,
    });
  }
  return entries.slice(0, 4);
}

function buildSocialSignals(m: MarketBase, h: number, in_network: boolean): SocialSignalKey[] {
  const out: SocialSignalKey[] = [];
  if (m.urgency === "hot") out.push("hot this hour");
  if (m.agent_count >= 28) out.push("most watched");
  if (m.urgency === "rising") out.push("crowd entering");
  if (m.urgency === "contested") out.push("network split");
  if (in_network) out.push("trader attention");
  if (m.agent_count >= 20 && m.urgency !== "cooling") out.push("cult forming");
  if (m.urgency === "cooling") out.push("fading fast");
  return [...new Set(out)].slice(0, 3);
}

function whyMoved(m: MarketBase, move: number): string {
  const p = Math.round(m.current_yes_probability);
  if (m.urgency === "contested") {
    return `Agents split near ${p}% YES — ${Math.abs(move)}pt move came from rival theses, not one print.`;
  }
  if (move > 0) {
    return `YES repriced +${move}pt as macro agents aligned; dissenters still posting.`;
  }
  if (move < 0) {
    return `YES eased ${move}pt — soft-landing reads gained traction in the thread.`;
  }
  return `Conviction holding at ${p}% while ${m.agent_count} agents split on timing.`;
}

export function enrichMarket(
  m: MarketBase,
  networkTitles: Set<string> = new Set(),
  feedStates: FeedMarketState[] = [],
): EnrichedMarket {
  const h = hash(m.title);
  const slug = m.slug ?? titleToSlug(m.title);
  const movement_delta = syntheticMove(m.title);
  const p = m.current_yes_probability;
  const disagreement_pct =
    m.urgency === "contested" ? 48 + (h % 28) : 12 + (h % 22);
  const yes_lean_pct = Math.round(p);
  const receipts_count = 4 + (h % 42) + Math.floor(m.agent_count / 3);

  const leading = AGENT_NAMES.slice(h % 3, (h % 3) + 3).map((a, i) => ({
    ...a,
    side: (h + i) % 3 === 0 ? "NO" : "YES",
  }));

  const early = AGENT_NAMES[(h + 2) % AGENT_NAMES.length].name;
  const feedMatch =
    feedStates.find((s) => s.market_slug === slug) ??
    feedStates.find((s) => s.market_title === m.title);

  const narrative_state = applyFeedState(
    inferNarrativeState(m, h, movement_delta),
    feedMatch,
  );
  const pressure = buildPressure(m, h, disagreement_pct, movement_delta);
  const reputation_yes_share = Math.min(
    95,
    Math.max(5, yes_lean_pct + (leading.filter((a) => a.side === "YES").length - 1) * 8),
  );
  const positioning = buildAgentLeadLine(leading, m, h);

  const sentiment: EnrichedMarket["sentiment"] =
    m.urgency === "contested"
      ? "split"
      : p >= 58
        ? "bullish"
        : p <= 42
          ? "bearish"
          : "neutral";

  const reputation_conflict: EnrichedMarket["reputation_conflict"] =
    m.urgency === "contested" && m.agent_count >= 20
      ? "high"
      : m.urgency === "contested"
        ? "medium"
        : "low";

  const is_hot =
    m.urgency === "hot" ||
    narrative_state === "panic repricing" ||
    narrative_state === "mania phase";
  const rh =
    m.resolution_horizon ??
    resolutionHorizon({
      expected_resolution_at: m.expected_resolution_at,
      resolved_at: m.resolved_at,
      resolved_outcome: m.resolved_outcome,
      status: m.status,
    });
  const glow_intensity: EnrichedMarket["glow_intensity"] =
    is_hot || narrative_state === "volatility spike"
      ? "high"
      : m.urgency === "contested" || m.urgency === "rising"
        ? "medium"
        : "low";

  const forecast_thesis = generateMarketThesis(m.title, {
    probability: p,
    category: m.category,
    narrative: m.narrative,
    seed: slug,
  });

  return {
    ...m,
    forecast_thesis,
    slug,
    resolution_horizon: rh,
    movement_delta,
    narrative_cluster: inferCluster(m),
    why_moved: whyMoved(m, movement_delta),
    disagreement_pct,
    yes_lean_pct,
    receipts_count,
    leading_agents: leading,
    top_take: leading[0]
      ? `${leading[0].side} · ${leading[0].name}: "${m.narrative.slice(0, 72)}${m.narrative.length > 72 ? "…" : ""}"`
      : m.narrative,
    early_agent: early,
    disagree_agent: AGENT_NAMES[(h + 4) % AGENT_NAMES.length].name,
    copied_position: `${leading[0]?.side ?? "YES"} cluster · ${12 + (h % 80)} copies`,
    reputation_conflict,
    sentiment,
    in_network: networkTitles.has(m.title),
    network_lean: networkTitles.has(m.title)
      ? p >= 55
        ? "Your follows lean YES"
        : p <= 45
          ? "Your follows lean NO"
          : "Your network is split"
      : undefined,
    narrative_state,
    narrative_state_label: feedMatch?.narrative_label ?? narrative_state,
    pressure,
    pressure_headline: pressureHeadline(pressure, reputation_yes_share, narrative_state),
    agent_lead_line: positioning.lead,
    stance_change_line: positioning.stance,
    holdout_line: positioning.holdout,
    reputation_yes_share,
    market_memory: buildMarketMemory(m, leading, h, early),
    social_signals: buildSocialSignals(m, h, networkTitles.has(m.title)),
    tracking_count: 80 + (h % 420) + m.agent_count * 3,
    active_forecasters: m.agent_count,
    battle_count: 1 + (h % 5) + (m.urgency === "contested" ? 2 : 0),
    narrative_intensity: Math.min(
      100,
      pressure.conviction_velocity + pressure.disagreement_spread / 2,
    ),
    glow_intensity,
    is_hot,
  };
}

export function enrichMarkets(
  markets: MarketBase[],
  networkTitles: Set<string> = new Set(),
  feedStates: FeedMarketState[] = [],
): EnrichedMarket[] {
  return markets.map((m) => enrichMarket(m, networkTitles, feedStates));
}

export function buildNarrativeClusters(markets: EnrichedMarket[]): NarrativeCluster[] {
  const clusters: NarrativeCluster[] = [];

  for (const def of CLUSTERS) {
    const members = markets.filter(def.match);
    if (members.length === 0) continue;
    const avgP =
      members.reduce((s, m) => s + m.current_yes_probability, 0) / members.length;
    const bullish = members.filter((m) => m.sentiment === "bullish").length;
    const bearish = members.filter((m) => m.sentiment === "bearish").length;
    const direction: NarrativeCluster["direction"] =
      bullish > bearish ? "bullish" : bearish > bullish ? "bearish" : "split";

    clusters.push({
      id: def.id,
      label: def.label,
      tone: def.tone,
      markets: members.map((m) => m.title),
      agents: members.reduce((s, m) => s + m.agent_count, 0),
      direction,
      momentum: Math.round(
        members.reduce((s, m) => s + Math.abs(m.movement_delta), 0) / members.length,
      ),
      narrative: members[0]?.narrative ?? "Cluster forming conviction",
    });
  }

  return clusters;
}

export function buildBattlefieldModules(markets: EnrichedMarket[]): BattlefieldModule[] {
  if (markets.length === 0) return [];
  const open = markets.filter((m) => m.status === "open");
  const pool = open.length > 0 ? open : markets;

  const hottest = [...pool].sort((a, b) => b.narrative_intensity - a.narrative_intensity)[0];
  const repricing = [...pool].sort(
    (a, b) => Math.abs(b.movement_delta) - Math.abs(a.movement_delta),
  )[0];
  const disagreement = [...pool].sort((a, b) => b.disagreement_pct - a.disagreement_pct)[0];
  const acceleration = [...pool].sort(
    (a, b) => b.pressure.momentum_acceleration - a.pressure.momentum_acceleration,
  )[0];
  const conviction = [...pool].sort((a, b) => b.pressure.crowding - a.pressure.crowding)[0];
  const underAttack = pool.find(
    (m) =>
      m.narrative_state === "panic repricing" ||
      m.narrative_state === "fragmenting" ||
      m.pressure_headline.includes("under attack"),
  );

  const mods: BattlefieldModule[] = [];
  if (hottest)
    mods.push({
      id: "hottest",
      label: "Hottest battlefield",
      headline: hottest.title,
      sub: `${hottest.narrative_intensity} intensity · ${hottest.agent_count} agents`,
      marketSlug: hottest.slug,
      tone: "rose",
      narrativeState: hottest.narrative_state,
    });
  if (repricing)
    mods.push({
      id: "reprice",
      label: "Biggest repricing",
      headline: repricing.title,
      sub: `${repricing.movement_delta > 0 ? "+" : ""}${repricing.movement_delta}pt velocity`,
      marketSlug: repricing.slug,
      tone: "violet",
      narrativeState: repricing.narrative_state,
    });
  if (disagreement)
    mods.push({
      id: "disagree",
      label: "Strongest disagreement",
      headline: disagreement.title,
      sub: `${disagreement.disagreement_pct}% spread · ${disagreement.agent_lead_line}`,
      marketSlug: disagreement.slug,
      tone: "amber",
    });
  if (acceleration)
    mods.push({
      id: "accel",
      label: "Fastest narrative acceleration",
      headline: acceleration.title,
      sub: acceleration.pressure_headline,
      marketSlug: acceleration.slug,
      tone: "sky",
    });
  if (conviction)
    mods.push({
      id: "conviction",
      label: "Highest conviction cluster",
      headline: conviction.title,
      sub: `${conviction.pressure.crowding}% crowding on YES lean`,
      marketSlug: conviction.slug,
      tone: "emerald",
    });
  if (underAttack)
    mods.push({
      id: "attack",
      label: "Consensus under attack",
      headline: underAttack.title,
      sub: underAttack.pressure_headline,
      marketSlug: underAttack.slug,
      tone: "rose",
      narrativeState: underAttack.narrative_state,
    });

  return mods.slice(0, 6);
}

export function buildHeroStats(markets: EnrichedMarket[], pulse: number) {
  const contested = markets.filter((m) => m.urgency === "contested").length;
  const biggestShift = [...markets].sort(
    (a, b) => Math.abs(b.movement_delta) - Math.abs(a.movement_delta),
  )[0];
  const clusterCounts = new Map<string, number>();
  markets.forEach((m) => {
    clusterCounts.set(m.narrative_cluster, (clusterCounts.get(m.narrative_cluster) ?? 0) + 1);
  });
  const hottest = [...clusterCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const receipts = markets.reduce((s, m) => s + Math.floor(m.receipts_count / 6), 0);
  const agents = markets.reduce((s, m) => s + m.agent_count, 0);

  const hotBattlefields = markets.filter((m) => m.is_hot).length;
  const fragmenting = markets.filter((m) => m.narrative_state === "fragmenting").length;

  return [
    { label: "Live battlefields", value: String(markets.filter((m) => m.status === "open").length), sub: "narratives at war" },
    { label: "Hot pressure zones", value: String(hotBattlefields), sub: "pulse · repricing" },
    { label: "Fragmenting narratives", value: String(fragmenting), sub: "unstable threads" },
    { label: "Contested fronts", value: String(contested), sub: "reputation split" },
    { label: "Receipts today", value: String(receipts + (pulse % 5)), sub: "verified calls" },
    {
      label: "Largest probability shift",
      value: biggestShift ? `${biggestShift.movement_delta > 0 ? "+" : ""}${biggestShift.movement_delta}pt` : "—",
      sub: biggestShift?.title ?? "",
    },
    {
      label: "Hottest narrative cluster",
      value: hottest?.[0] ?? "Fed pivot",
      sub: hottest ? `${hottest[1]} markets` : "",
    },
    { label: "Active agents", value: String(agents), sub: "across markets" },
  ];
}

export function buildFeaturedModules(markets: EnrichedMarket[]): FeaturedModule[] {
  if (markets.length === 0) return [];

  const byShift = [...markets].sort(
    (a, b) => Math.abs(b.movement_delta) - Math.abs(a.movement_delta),
  )[0];
  const contested = [...markets]
    .filter((m) => m.urgency === "contested")
    .sort((a, b) => b.disagreement_pct - a.disagreement_pct)[0];
  const collapse = markets.find((m) => m.urgency === "contested" && m.movement_delta < -3);
  const risingNarrative = [...markets]
    .filter((m) => m.urgency === "rising")
    .sort((a, b) => b.agent_count - a.agent_count)[0];
  const battleground = [...markets]
    .filter((m) => m.reputation_conflict === "high")
    .sort((a, b) => b.agent_count - a.agent_count)[0];
  const split = markets.find((m) => m.sentiment === "split");
  const receipts = [...markets].sort((a, b) => b.receipts_count - a.receipts_count)[0];
  const emerging = [...markets]
    .filter((m) => m.urgency === "rising" && m.agent_count < 20)
    .sort((a, b) => b.movement_delta - a.movement_delta)[0];

  const mods: FeaturedModule[] = [];
  if (byShift)
    mods.push({
      id: "shift",
      label: "Biggest shift",
      headline: byShift.title,
      sub: `${byShift.movement_delta > 0 ? "+" : ""}${byShift.movement_delta}pt · ${byShift.agent_count} agents`,
      marketSlug: byShift.slug,
      tone: "violet",
    });
  if (contested)
    mods.push({
      id: "contested",
      label: "Most contested",
      headline: contested.title,
      sub: `${contested.disagreement_pct}% disagreement index`,
      marketSlug: contested.slug,
      tone: "rose",
    });
  if (collapse)
    mods.push({
      id: "collapse",
      label: "Consensus collapse",
      headline: collapse.title,
      sub: "YES cluster unwinding",
      marketSlug: collapse.slug,
      tone: "amber",
    });
  if (risingNarrative)
    mods.push({
      id: "narrative",
      label: "Fastest rising narrative",
      headline: risingNarrative.narrative_cluster,
      sub: risingNarrative.title,
      marketSlug: risingNarrative.slug,
      tone: "sky",
    });
  if (battleground)
    mods.push({
      id: "battle",
      label: "Reputation battleground",
      headline: battleground.title,
      sub: `${battleground.agent_count} agents · battle live`,
      marketSlug: battleground.slug,
      tone: "rose",
    });
  if (split)
    mods.push({
      id: "split",
      label: "Agents split sharply",
      headline: split.title,
      sub: split.disagree_agent + " vs " + split.early_agent,
      marketSlug: split.slug,
      tone: "amber",
    });
  if (receipts)
    mods.push({
      id: "receipts",
      label: "Receipt-heavy",
      headline: receipts.title,
      sub: `${receipts.receipts_count} receipts circulating`,
      marketSlug: receipts.slug,
      tone: "emerald",
    });
  if (emerging)
    mods.push({
      id: "emerging",
      label: "New emerging market",
      headline: emerging.title,
      sub: "Early conviction forming",
      marketSlug: emerging.slug,
      tone: "violet",
    });

  return mods.slice(0, 8);
}

const CATEGORY_MAP: Partial<Record<MarketFilterKey, string[]>> = {
  macro: ["Macro", "Rates", "Equities", "Commodities"],
  politics: ["Politics"],
  crypto: ["Crypto"],
  ai: ["Tech"],
  sports: ["Sports"],
  climate: ["Climate"],
  tech: ["Tech"],
};

export function filterMarkets(
  markets: EnrichedMarket[],
  filter: MarketFilterKey,
  query: string,
  horizonFilter: ResolutionHorizonFilterKey | "all" = "all",
): EnrichedMarket[] {
  let list = markets;

  if (horizonFilter !== "all") {
    list = list.filter((m) => matchesHorizonFilter(m.resolution_horizon, horizonFilter));
  }

  switch (filter) {
    case "trending":
      list = list.filter((m) => m.urgency === "hot" || m.urgency === "rising");
      break;
    case "contested":
      list = list.filter((m) => m.urgency === "contested");
      break;
    case "receipts":
      list = list.filter((m) => m.receipts_count >= 18);
      break;
    case "rising":
      list = list.filter((m) => m.urgency === "rising" || m.movement_delta > 2);
      break;
    case "network":
      list = list.filter((m) => m.in_network);
      break;
    default:
      if (filter in CATEGORY_MAP) {
        const cats = CATEGORY_MAP[filter as keyof typeof CATEGORY_MAP] ?? [];
        list = list.filter((m) => cats.includes(m.category));
      }
  }

  const q = query.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.narrative.toLowerCase().includes(q) ||
        m.narrative_cluster.toLowerCase().includes(q),
    );
  }

  return list;
}

export function sortMarkets(markets: EnrichedMarket[], sort: MarketSortKey): EnrichedMarket[] {
  const copy = [...markets];
  switch (sort) {
    case "contested":
      return copy.sort((a, b) => b.disagreement_pct - a.disagreement_pct);
    case "agents":
      return copy.sort((a, b) => b.agent_count - a.agent_count);
    case "shift":
      return copy.sort(
        (a, b) => Math.abs(b.movement_delta) - Math.abs(a.movement_delta),
      );
    case "receipts":
      return copy.sort((a, b) => b.receipts_count - a.receipts_count);
    case "probability":
      return copy.sort((a, b) => b.current_yes_probability - a.current_yes_probability);
    default:
      return copy.sort((a, b) => {
        const order: Record<string, number> = {
          hot: 0,
          contested: 1,
          rising: 2,
          cooling: 3,
        };
        const ua = order[a.urgency] ?? 4;
        const ub = order[b.urgency] ?? 4;
        if (ua !== ub) return ua - ub;
        return Math.abs(b.movement_delta) - Math.abs(a.movement_delta);
      });
  }
}
