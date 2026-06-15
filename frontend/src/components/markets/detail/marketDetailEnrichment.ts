import { syntheticMove } from "@/components/feed/shared";
import { momentumFromSeed } from "@/components/feed/motion";
import { buildProbHistoryValues } from "./marketChartData";
import { enrichMarket } from "@/components/markets/marketEnrichment";
import { resolveMarketCredibility } from "./marketDetailCredibility";
import type {
  AgentTake,
  ActivityItem,
  ConvictionStripEvent,
  EnrichedMarketDetail,
  FactionBloc,
  IntelligenceWidget,
  MarketDetail,
  NetworkPulseItem,
  PressureInsight,
  ResolutionScenario,
} from "./types";

function hash(s: string) {
  return s.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

const STRIP_TAGS = [
  "Rising conviction",
  "Consensus shift",
  "New entry",
  "Agent flip",
  "Battle escalation",
  "Narrative acceleration",
  "Exit signal",
  "Repricing",
] as const;

function buildStripEvents(
  market: MarketDetail,
  activity: ActivityItem[],
  takes: AgentTake[],
): ConvictionStripEvent[] {
  const events: ConvictionStripEvent[] = [];

  const activityTag = (type: string, title: string, h: number) => {
    if (type === "rivalry" || type === "battle_escalation") return "Battle escalation";
    if (type === "receipt" || type === "verified_call") return "Receipt verified";
    if (type === "consensus_shift" || type === "narrative_acceleration") return "Consensus shift";
    if (type === "confidence_shift" || type === "signal_shift") return "Rising conviction";
    return STRIP_TAGS[h % STRIP_TAGS.length];
  };

  for (const item of activity.slice(0, 5)) {
    const h = hash(item.title + item.agent_slug);
    events.push({
      id: `act-${item.agent_slug}-${item.created_at}`,
      agent_name: item.agent_name,
      agent_slug: item.agent_slug,
      tag: activityTag(item.type, item.title, h),
      delta: item.probability != null ? syntheticMove(item.title) : undefined,
      side: item.probability != null && item.probability >= 50 ? "YES" : "NO",
      at: item.created_at,
    });
  }

  for (const take of takes.slice(0, 3)) {
    events.push({
      id: `take-${take.slug}`,
      agent_name: take.name,
      agent_slug: take.slug,
      tag: take.side === "YES" ? "Rising conviction" : "Contrarian entry",
      side: take.side,
      delta: Math.round(take.confidence - market.current_yes_probability) || undefined,
      at: new Date(Date.now() - (hash(take.slug) % 12) * 3600000).toISOString(),
    });
  }

  return events.slice(0, 8);
}

const COALITION_NAMES: Record<string, { yes: string; no: string }> = {
  Macro: { yes: "Macro slowdown coalition", no: "Soft landing holdouts" },
  Rates: { yes: "Dovish pivot bloc", no: "Higher-for-longer cluster" },
  Equities: { yes: "AI melt-up bloc", no: "Bubble skeptic cluster" },
  Politics: { yes: "Incumbent stability wing", no: "Upset volatility cluster" },
  Crypto: { yes: "Breakout momentum desk", no: "Capitulation watch" },
  Tech: { yes: "AI acceleration coalition", no: "Regulatory overhang bloc" },
  Sports: { yes: "Favorite consensus pack", no: "Upset chaos cluster" },
  Climate: { yes: "Regulation pressure bloc", no: "Policy delay skeptics" },
};

function coalitionNames(category: string, cluster: string, h: number) {
  const base = COALITION_NAMES[category] ?? {
    yes: `${cluster} — YES wing`,
    no: `Contrarian ${cluster} cluster`,
  };
  if (h % 5 === 0) return { yes: base.yes, no: "Isolated holdout desk" };
  return base;
}

function warRoomLine(
  state: string,
  fragmentation: number,
  move: number,
  urgency: string,
): string {
  if (state === "panic repricing") return "Panic repricing — consensus under siege.";
  if (state === "fragmenting" || state === "institutional split")
    return "Consensus fragmenting after macro repricing.";
  if (state === "contrarian breakout") return "Contrarian pressure building against the crowd.";
  if (state === "crowded" || state === "mania phase")
    return "Momentum crowding accelerating — late conviction piling in.";
  if (state === "institutional split") return "Institutional split widening across the network.";
  if (fragmentation >= 45) return "Network deadlocked — factions testing rival futures.";
  if (move > 3) return "Repricing wave — high-rep desks leading the move.";
  if (urgency === "contested") return "Battle intensity rising — timing divergence widening.";
  if (move < -2) return "Consensus easing — contrarian window opening.";
  return "Conviction war room active — competing futures colliding.";
}

function timingPressure(urgency: string, velocity: number, fragmentation: number): string {
  if (urgency === "hot") return "Resolution window compressing — timing exposure elevated";
  if (velocity >= 70) return "Velocity spike — early movers gaining narrative leverage";
  if (fragmentation >= 40) return "Timing divergence — agents pricing different horizons";
  return "Timing stable — conviction accumulating before next catalyst";
}

function buildFactionBlocs(
  takes: AgentTake[],
  category: string,
  cluster: string,
  h: number,
  repYesShare: number,
): FactionBloc[] {
  const names = coalitionNames(category, cluster, h);
  const yesAgents = takes.filter((t) => t.side === "YES").slice(0, 4);
  const noAgents = takes.filter((t) => t.side === "NO").slice(0, 4);
  const yesMom =
    repYesShare >= 65 ? "surging" : repYesShare >= 45 ? "holding" : ("weakening" as const);
  const noMom =
    repYesShare <= 35 ? "surging" : repYesShare <= 55 ? "holding" : ("isolated" as const);

  return [
    {
      side: "YES",
      name: names.yes,
      narrative: `Dominant thesis: ${cluster} alignment on YES`,
      momentum: yesMom,
      rep_concentration: repYesShare,
      agents: yesAgents,
    },
    {
      side: "NO",
      name: names.no,
      narrative: `Counter-thesis: dissent against ${Math.round(repYesShare)}% rep-weighted YES`,
      momentum: noMom,
      rep_concentration: 100 - repYesShare,
      agents: noAgents,
      holdout_note:
        noAgents.length === 1
          ? `${noAgents[0]?.name ?? "Lone agent"} isolated against consensus`
          : undefined,
    },
  ];
}

function buildPressureInsights(
  enriched: ReturnType<typeof enrichMarket>,
  market: MarketDetail,
  velocity: number,
  fragmentation: number,
): PressureInsight[] {
  const p = enriched.pressure;
  const rep = enriched.reputation_yes_share;
  return [
    {
      label: "Reputation alignment",
      value:
        rep >= 72
          ? `${rep}% of reputation aligned YES`
          : rep <= 28
            ? `${100 - rep}% of reputation stacked NO`
            : `Split — ${rep}% rep on YES`,
      tone: rep >= 65 ? "violet" : rep <= 35 ? "rose" : "amber",
    },
    {
      label: "Crowding",
      value:
        p.crowding >= 75
          ? "Crowded conviction — late entrants accelerating"
          : p.crowding >= 50
            ? "Building crowd — momentum attracting copies"
            : "Room to build — conviction not yet crowded",
      tone: p.crowding >= 70 ? "amber" : "zinc",
    },
    {
      label: "Conviction velocity",
      value:
        velocity >= 65
          ? "Velocity surging — repricing in motion"
          : "Steady accumulation — no panic yet",
      tone: velocity >= 60 ? "rose" : "emerald",
    },
    {
      label: "Disagreement",
      value:
        fragmentation >= 45
          ? "Consensus weakening despite repricing"
          : "Disagreement contained — one faction leading",
      tone: fragmentation >= 40 ? "rose" : "violet",
    },
    {
      label: "Timing divergence",
      value:
        p.timing_divergence >= 60
          ? "Agents pricing different resolution horizons"
          : "Timing aligned — catalyst window shared",
      tone: "amber",
    },
    {
      label: "Battle pressure",
      value:
        market.urgency === "contested"
          ? "Contrarians gaining momentum in open threads"
          : "Battle threads cooling — dominance consolidating",
      tone: market.urgency === "contested" ? "rose" : "zinc",
    },
  ];
}

function buildResolutionScenarios(
  market: MarketDetail,
  enriched: ReturnType<typeof enrichMarket>,
  blocs: FactionBloc[],
): ResolutionScenario[] {
  const yesBloc = blocs.find((b) => b.side === "YES");
  const noBloc = blocs.find((b) => b.side === "NO");
  const leadYes = yesBloc?.agents[0]?.name ?? enriched.leading_agents[0]?.name ?? "YES coalition";
  const leadNo = noBloc?.agents[0]?.name ?? enriched.disagree_agent;

  return [
    {
      outcome: "YES",
      headline: "YES verifies — macro coalition gains dominance",
      winners: [leadYes, ...enriched.leading_agents.filter((a) => a.side === "YES").map((a) => a.name)].slice(0, 3),
      losers: [leadNo, enriched.disagree_agent].filter(Boolean).slice(0, 2) as string[],
      faction_fate: `${yesBloc?.name ?? "YES bloc"} absorbs narrative control; ${noBloc?.name ?? "NO holdouts"} credibility collapses`,
      narrative: `Thread reprices to institutional memory — "${market.title}" becomes a YES legend`,
      season_note: `${leadYes} likely overtakes Timing rankings this season`,
    },
    {
      outcome: "NO",
      headline: "NO verifies — contrarian cluster vindicated",
      winners: [leadNo, ...enriched.leading_agents.filter((a) => a.side === "NO").map((a) => a.name)].slice(0, 3),
      losers: [leadYes, enriched.early_agent].filter(Boolean).slice(0, 2) as string[],
      faction_fate: `${noBloc?.name ?? "NO cluster"} gains permanent archive status; crowded YES bloc punished`,
      narrative: "Consensus collapse archived — late YES entrants face reputation drawdown",
      season_note: "Coalition map reshuffles — contrarian timing desks rise",
    },
  ];
}

function buildNetworkPulse(
  market: MarketDetail,
  strip: ConvictionStripEvent[],
  enriched: ReturnType<typeof enrichMarket>,
): NetworkPulseItem[] {
  const items: NetworkPulseItem[] = [];
  const now = Date.now();

  for (const ev of strip.slice(0, 4)) {
    items.push({
      id: `pulse-${ev.id}`,
      kind: ev.tag.includes("Battle") ? "battle" : "take",
      text: `${ev.agent_name}: ${ev.tag}${ev.delta != null ? ` (${ev.delta > 0 ? "+" : ""}${ev.delta}pt)` : ""}`,
      at: ev.at,
    });
  }

  if (enriched.stance_change_line) {
    items.push({
      id: "pulse-stance",
      kind: "faction",
      text: enriched.stance_change_line,
      at: new Date(now - 1800000).toISOString(),
    });
  }

  items.push({
    id: "pulse-rep",
    kind: "rep",
    text: `${enriched.reputation_yes_share}% reputation mass on YES — ${enriched.reputation_conflict === "high" ? "imbalance elevated" : "stable"}`,
    at: new Date(now - 3600000).toISOString(),
  });

  items.push({
    id: "pulse-narr",
    kind: "narrative",
    text: `Narrative state: ${enriched.narrative_state_label} — ${enriched.pressure_headline.slice(0, 56)}`,
    at: new Date(now - 5400000).toISOString(),
  });

  if (market.urgency === "contested") {
    items.push({
      id: "pulse-battle",
      kind: "battle",
      text: "Battle escalation — spread widening on contested thread",
      at: new Date(now - 7200000).toISOString(),
    });
  }

  return items.slice(0, 8);
}

function buildIntelligence(
  market: MarketDetail,
  bullish: AgentTake | null,
  contrarian: AgentTake | null,
  largest: EnrichedMarketDetail["largest_position"],
  fastest: AgentTake | null,
  enriched: ReturnType<typeof enrichMarket>,
  why_moving: EnrichedMarketDetail["why_moving"],
  credibility: EnrichedMarketDetail["credibility"],
): IntelligenceWidget[] {
  const mover = why_moving.first_movers[0];
  const movLabel =
    credibility.movement_type === "contrarian_led"
      ? "Contrarian-led"
      : credibility.movement_type === "consensus_led"
        ? "Consensus-led"
        : "Mixed";
  return [
    {
      id: "bullish",
      label: "Most bullish agent",
      value: bullish?.name ?? "—",
      sub: bullish ? `${Math.round(bullish.confidence)}% conviction · ${bullish.side}` : "No lead yet",
      tone: "emerald",
      href: bullish ? `/agents/${bullish.slug}` : undefined,
    },
    {
      id: "contrarian",
      label: "Strongest contrarian",
      value: contrarian?.name ?? "—",
      sub: contrarian ? `Against ${Math.round(market.current_yes_probability)}% consensus` : "Aligned crowd",
      tone: "rose",
      href: contrarian ? `/agents/${contrarian.slug}` : undefined,
    },
    {
      id: "largest",
      label: "Largest position",
      value: largest.agent,
      sub: `${largest.side} · €${largest.amount} exposure`,
      tone: "violet",
      href: `/agents/${largest.slug}`,
    },
    {
      id: "fastest",
      label: "Fastest conviction rise",
      value: fastest?.name ?? "—",
      sub: fastest ? `+${Math.max(4, Math.round(fastest.confidence - market.current_yes_probability))}pt momentum` : "Stable",
      tone: "sky",
      href: fastest ? `/agents/${fastest.slug}` : undefined,
    },
    {
      id: "accurate",
      label: "Top calibration",
      value: enriched.early_agent,
      sub: "Highest verified timing on thread",
      tone: "emerald",
      href: `/agents/${enriched.leading_agents[0]?.slug ?? "macro-oracle"}`,
    },
    {
      id: "narrative",
      label: "Narrative velocity",
      value: `${enriched.disagreement_pct > 40 ? "Accelerating" : "Building"}`,
      sub: enriched.narrative_cluster,
      tone: "sky",
    },
    {
      id: "battle",
      label: "Battle intensity",
      value: enriched.urgency === "contested" ? "High" : "Moderate",
      sub: `${enriched.disagreement_pct}% divergence`,
      tone: "rose",
      href: "/battles",
    },
    {
      id: "reputation",
      label: "Reputation exposure",
      value: enriched.reputation_conflict === "high" ? "Elevated" : "Normal",
      sub: `${enriched.receipts_count} archived calls on thread`,
      tone: "amber",
      href: "/reputation",
    },
    {
      id: "movement",
      label: "Why moving",
      value: movLabel,
      sub: mover ? `${mover.name} · ${Math.round(mover.reputation_score)} rep` : why_moving.summary.slice(0, 42),
      tone: credibility.consensus_breaking ? "rose" : "violet",
    },
  ];
}

export function enrichMarketDetail(market: MarketDetail): EnrichedMarketDetail {
  const enriched = enrichMarket(market);
  const { takes, credibility, why_moving } = resolveMarketCredibility(market);
  const marketWithTakes = { ...market, agent_takes: takes };
  const h = hash(market.slug);
  const movement_delta = syntheticMove(market.title);
  const momentum = momentumFromSeed(market.slug);

  const yesTakes = takes.filter((t) => t.side === "YES");
  const noTakes = takes.filter((t) => t.side === "NO");

  const bullish_agent =
    [...takes].sort((a, b) => b.confidence - a.confidence).find((t) => t.side === "YES") ?? null;
  const contrarian_agent =
    [...takes].filter((t) => t.side === "NO").sort((a, b) => b.confidence - a.confidence)[0] ?? null;
  const fastest_rise =
    [...takes].sort(
      (a, b) =>
        Math.abs(b.confidence - market.current_yes_probability) -
        Math.abs(a.confidence - market.current_yes_probability),
    )[0] ?? null;

  const largestIdx = h % Math.max(1, takes.length);
  const largestTake = takes[largestIdx] ?? takes[0];
  const largest_position = {
    agent: largestTake?.name ?? "Macro Oracle",
    slug: largestTake?.slug ?? "macro-oracle",
    side: largestTake?.side ?? "YES",
    amount: 8 + (h % 42),
  };

  const contested_level: EnrichedMarketDetail["contested_level"] =
    market.urgency === "contested" && market.agent_count >= 20
      ? "extreme"
      : market.urgency === "contested"
        ? "high"
        : enriched.disagreement_pct > 35
          ? "moderate"
          : "low";

  const volatility: EnrichedMarketDetail["volatility"] =
    Math.abs(movement_delta) >= 5 || contested_level === "extreme"
      ? "high"
      : Math.abs(movement_delta) >= 2
        ? "medium"
        : "low";

  const prob_history = buildProbHistoryValues(
    market.slug,
    market.current_yes_probability,
    movement_delta,
    volatility,
  );

  const strip_events = buildStripEvents(marketWithTakes, market.recent_activity, takes);

  const detail = {
    ...marketWithTakes,
    enriched,
    credibility,
    why_moving,
    movement_delta,
    momentum,
    volatility,
    contested_level,
    conviction_velocity: 40 + (h % 55) + (market.urgency === "hot" ? 12 : 0),
    narrative_velocity: enriched.disagreement_pct,
    battle_intensity: market.urgency === "contested" ? 72 + (h % 24) : 28 + (h % 40),
    reputation_exposure: enriched.reputation_conflict === "high" ? 78 : 34 + (h % 30),
    consensus_fragmentation: enriched.disagreement_pct,
    intelligence: [] as IntelligenceWidget[],
    strip_events,
    prob_history,
    yes_count: yesTakes.length,
    no_count: noTakes.length,
    largest_position,
    bullish_agent,
    contrarian_agent,
    fastest_rise,
  };

  detail.intelligence = buildIntelligence(
    marketWithTakes,
    bullish_agent,
    contrarian_agent,
    largest_position,
    fastest_rise,
    enriched,
    why_moving,
    credibility,
  );

  const faction_blocs = buildFactionBlocs(
    takes,
    market.category,
    enriched.narrative_cluster,
    h,
    enriched.reputation_yes_share,
  );

  const market_heat = Math.min(
    99,
    detail.battle_intensity * 0.35 +
      detail.conviction_velocity * 0.25 +
      enriched.narrative_intensity * 0.2 +
      (market.urgency === "hot" ? 18 : market.urgency === "contested" ? 12 : 0),
  );

  const dominant_faction: EnrichedMarketDetail["dominant_faction"] =
    enriched.reputation_yes_share >= 58
      ? "YES"
      : enriched.reputation_yes_share <= 42
        ? "NO"
        : "split";

  return {
    ...detail,
    resolution_horizon: enriched.resolution_horizon,
    war_room_line: warRoomLine(
      enriched.narrative_state,
      detail.consensus_fragmentation,
      movement_delta,
      market.urgency,
    ),
    timing_pressure: timingPressure(
      market.urgency,
      detail.conviction_velocity,
      detail.consensus_fragmentation,
    ),
    market_heat: Math.round(market_heat),
    dominant_faction,
    faction_blocs,
    pressure_insights: buildPressureInsights(enriched, market, detail.conviction_velocity, detail.consensus_fragmentation),
    resolution_scenarios: buildResolutionScenarios(market, enriched, faction_blocs),
    network_pulse: buildNetworkPulse(marketWithTakes, strip_events, enriched),
  };
}
