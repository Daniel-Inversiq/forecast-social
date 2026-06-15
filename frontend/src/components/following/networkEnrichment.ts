import type { EnrichedAgent, ForecasterBase } from "@/components/agents/types";
import { enrichAgents } from "@/components/agents/agentEnrichment";
import type {
  AgentChip,
  FeedEvent,
  FollowingFeed,
  IntelligenceInsight,
  LiveFeedItem,
  MarketTake,
  NetworkBriefLine,
  NetworkCluster,
  NetworkProfileTag,
  NetworkRelationship,
  NetworkSignal,
  NetworkSuggestion,
  OverviewCard,
  SectorPressure,
} from "./types";

function hash(slug: string) {
  return slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

const STYLE_BY_NICHE: Record<string, string> = {
  Macro: "policy-first",
  Tech: "evidence-led",
  Crypto: "volatile",
  Sports: "momentum",
  Politics: "data-driven",
  Climate: "long horizon",
};

const TAGLINE_BY_NICHE: Record<string, string> = {
  Macro: "Calm · structural",
  Tech: "Optimistic · crisp",
  Crypto: "Volatile · irreverent",
  Sports: "Energetic · punchy",
  Politics: "Measured · wonkish",
  Climate: "Steady · patient",
};

export function chipToForecaster(chip: AgentChip): ForecasterBase {
  const h = hash(chip.slug);
  return {
    name: chip.name,
    slug: chip.slug,
    niche: chip.niche,
    avatar_color: chip.avatar_color,
    conviction_style: STYLE_BY_NICHE[chip.niche] ?? "high conviction",
    streak: 5 + (h % 10),
    accuracy_score: 82 + (h % 14),
    follower_count: 8 + (h % 18),
    personality_tagline: TAGLINE_BY_NICHE[chip.niche] ?? "Analytical · direct",
  };
}

export function enrichFollowedAgents(chips: AgentChip[]): EnrichedAgent[] {
  return enrichAgents(chips.map(chipToForecaster));
}

export function mergeAgentCatalog(
  chips: AgentChip[],
  catalog: ForecasterBase[],
): EnrichedAgent[] {
  const bySlug = new Map(catalog.map((a) => [a.slug, a]));
  const bases = chips.map((c) => bySlug.get(c.slug) ?? chipToForecaster(c));
  return enrichAgents(bases);
}

const CLUSTER_DEFS: { id: string; label: string; tone: NetworkCluster["tone"]; match: (a: EnrichedAgent) => boolean }[] = [
  {
    id: "macro",
    label: "Macro cluster",
    tone: "sky",
    match: (a) => ["Macro", "Rates", "Equities", "Multi"].includes(a.niche),
  },
  {
    id: "ai",
    label: "AI optimism cluster",
    tone: "violet",
    match: (a) => a.niche === "Tech" || a.strongest_narrative.toLowerCase().includes("ai"),
  },
  {
    id: "contrarian",
    label: "Contrarian cluster",
    tone: "rose",
    match: (a) => a.personality === "contrarian" || a.tags.includes("contrarian"),
  },
  {
    id: "consensus",
    label: "Consensus cluster",
    tone: "emerald",
    match: (a) => a.agreement_pct >= 55 && a.personality !== "contrarian",
  },
  {
    id: "sports",
    label: "Sports momentum cluster",
    tone: "amber",
    match: (a) => a.niche === "Sports",
  },
];

export function buildNetworkClusters(agents: EnrichedAgent[]): NetworkCluster[] {
  const clusters: NetworkCluster[] = [];

  for (const def of CLUSTER_DEFS) {
    const members = agents.filter(def.match);
    if (members.length === 0) continue;
    const agreement =
      members.reduce((s, a) => s + a.agreement_pct, 0) / members.length;
    const bullish = members.filter((a) => a.trend === "up").length;
    const bearish = members.filter((a) => a.trend === "down").length;
    const direction: NetworkCluster["direction"] =
      bullish > bearish + 1
        ? "bullish"
        : bearish > bullish + 1
          ? "bearish"
          : bullish + bearish > 0
            ? "split"
            : "neutral";
    const narrative = [...members]
      .sort((a, b) => b.reputation_score - a.reputation_score)[0]
      ?.strongest_narrative;

    clusters.push({
      id: def.id,
      label: def.label,
      tone: def.tone,
      agents: members.map((a) => a.name),
      agreement: Math.round(agreement),
      narrative: narrative ?? "Cross-market alignment",
      direction,
    });
  }

  return clusters.slice(0, 5);
}

export function buildHeroStats(
  agents: EnrichedAgent[],
  feed: FollowingFeed,
  pulse: number,
) {
  const narratives = new Set(agents.map((a) => a.strongest_narrative));
  const contested = feed.feed_events.filter((e) =>
    ["rivalry", "consensus_shift"].includes(e.type),
  ).length;
  const receipts = agents.reduce((s, a) => s + Math.floor(a.receipts_count / 9), 0);
  const overlap =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.agreement_pct, 0) / agents.length)
      : 0;
  const avgRep =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.reputation_score, 0) / agents.length)
      : 0;
  const contrarian = agents.filter(
    (a) => a.personality === "contrarian" || a.heat_state === "consensus_enemy",
  ).length;
  const rivalries = agents.filter((a) => a.active_clashes >= 1).length;
  const rising = agents.filter((a) => a.trend === "up").length;

  return [
    { label: "Network size", value: String(agents.length), sub: "followed desks" },
    { label: "Rep density", value: String(avgRep), sub: "avg reputation" },
    { label: "Narratives", value: String(narratives.size || 3 + (pulse % 2)), sub: "active clusters" },
    { label: "Consensus align", value: `${overlap}%`, sub: "with your worldview" },
    { label: "Contrarian exp.", value: `${contrarian}`, sub: "dissent voices" },
    { label: "Active rivalries", value: String(rivalries + contested), sub: "live fractures" },
    { label: "Rising desks", value: String(rising + (pulse % 2)), sub: "momentum up" },
    { label: "Verified calls", value: String(receipts + (pulse % 4)), sub: "this week" },
  ];
}

export function buildOverviewStrip(
  agents: EnrichedAgent[],
  feed: FollowingFeed,
): OverviewCard[] {
  const topSignal = feed.feed_events[0];
  const rivalry = feed.feed_events.find((e) => e.type === "rivalry");
  const rising = [...agents].sort((a, b) => b.rank_delta - a.rank_delta)[0];
  const narrativeCounts = new Map<string, number>();
  agents.forEach((a) => {
    narrativeCounts.set(
      a.strongest_narrative,
      (narrativeCounts.get(a.strongest_narrative) ?? 0) + 1,
    );
  });
  const hottest = [...narrativeCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const aligned = [...agents].sort((a, b) => b.agreement_pct - a.agreement_pct)[0];
  const topTake = feed.new_takes[0];
  const contested = feed.feed_events.filter((e) =>
    ["rivalry", "consensus_shift"].includes(e.type),
  ).length;

  const contrarianPct =
    agents.length > 0
      ? Math.round(
          (agents.filter((a) => a.personality === "contrarian").length / agents.length) * 100,
        )
      : 0;
  const macroCount = agents.filter((a) =>
    ["Macro", "Rates", "Equities", "Multi"].includes(a.niche),
  ).length;
  const timingLeaders = [...agents].sort((a, b) => b.early_on_pct - a.early_on_pct)[0];

  return [
    {
      id: "mood",
      label: "Network mood",
      value:
        feed.new_takes.length >= 3
          ? "Elevated conviction"
          : contested > 0
            ? "Contested · shifting"
            : "Calibrating",
      sub: `${feed.feed_events.length} live signals`,
      tone: contested > 0 ? "rose" : "violet",
      seed: "mood",
      pulse: contested > 0,
    },
    {
      id: "faction",
      label: "Faction balance",
      value: macroCount >= agents.length / 2 ? "Macro-heavy bloc" : "Cross-sector blend",
      sub: `${contrarianPct}% contrarian weight`,
      tone: "sky",
      seed: "faction",
    },
    {
      id: "timing",
      label: "Timing climate",
      value: timingLeaders?.name ?? "—",
      sub: timingLeaders ? `${timingLeaders.early_on_pct}% early edge` : "no leader yet",
      tone: "emerald",
      seed: timingLeaders?.slug ?? "timing",
    },
    {
      id: "signal",
      label: "Strongest signal today",
      value: topSignal?.title ?? "Network warming up",
      sub: topSignal ? topSignal.agent.name : "Follow agents to unlock",
      tone: "violet",
      seed: topSignal?.agent.slug ?? "signal",
      pulse: true,
    },
    {
      id: "disagree",
      label: "Consensus fracture",
      value: rivalry?.title ?? "No sharp split yet",
      sub: rivalry?.market_title ?? "Contested takes incoming",
      tone: "rose",
      seed: rivalry?.agent.slug ?? "disagree",
    },
    {
      id: "rising",
      label: "Fastest rising follow",
      value: rising?.name ?? "—",
      sub: rising ? `+${rising.rank_delta} reputation` : "",
      tone: "emerald",
      seed: rising?.slug ?? "rising",
    },
    {
      id: "narrative",
      label: "Hottest narrative",
      value: hottest?.[0] ?? "Fed pivot cluster",
      sub: hottest ? `${hottest[1]} agents aligned` : "among follows",
      tone: "sky",
      seed: hottest?.[0] ?? "narrative",
    },
    {
      id: "market",
      label: "Most aligned market",
      value: feed.moved_markets[0]?.title ?? aligned?.strongest_market ?? "—",
      sub: feed.moved_markets[0]
        ? `${Math.round(feed.moved_markets[0].current_yes_probability)}% YES`
        : aligned
          ? `${aligned.agreement_pct}% overlap`
          : "",
      tone: "amber",
      seed: feed.moved_markets[0]?.title ?? aligned?.slug ?? "market",
    },
    {
      id: "conviction",
      label: "Highest conviction take",
      value: topTake ? `${topTake.side} · ${topTake.market_title}` : "Awaiting takes",
      sub: topTake ? `${Math.round(topTake.confidence)}% confidence` : "from your network",
      tone: "violet",
      seed: topTake?.agent.slug ?? "conviction",
    },
  ];
}

function whyForEvent(event: FeedEvent, agentCount: number): string {
  switch (event.type) {
    case "confidence_shift":
      return agentCount > 1
        ? "Multiple agents you follow are repricing conviction on this market."
        : "A followed agent shifted conviction — this feeds your personalized stream.";
    case "rivalry":
      return "Your network split sharply — watch for narrative divergence.";
    case "receipt":
      return "Receipt activity from your network — reputation is compounding.";
    case "consensus_shift":
      return agentCount > 2
        ? "Agents you follow are clustering around a new consensus."
        : "Consensus in your network is moving — your worldview may need updating.";
    case "leaderboard_move":
      return "Reputation velocity in your intelligence network.";
    default:
      return "Signal from a forecasting identity you track.";
  }
}

function whyForTake(take: MarketTake, yesCount: number, noCount: number): string {
  if (yesCount >= 2 && take.side === "YES")
    return "Agents you follow are clustering around YES.";
  if (noCount >= 2 && take.side === "NO")
    return "Your network is leaning NO on related markets.";
  return `${take.agent.name} posted a high-conviction take in your network.`;
}

export function buildIntelligenceFeed(
  feed: FollowingFeed,
  agents: EnrichedAgent[],
): IntelligenceInsight[] {
  const insights: IntelligenceInsight[] = [];
  const yesTakes = feed.new_takes.filter((t) => t.side === "YES").length;
  const noTakes = feed.new_takes.filter((t) => t.side === "NO").length;

  feed.feed_events.slice(0, 14).forEach((event, i) => {
    const tone =
      event.type === "rivalry"
        ? "rose"
        : event.type === "receipt"
          ? "emerald"
          : event.type === "consensus_shift"
            ? "sky"
            : "violet";
    insights.push({
      id: `event-${i}`,
      why: whyForEvent(event, agents.length),
      headline: event.title,
      body: event.body,
      type: event.type,
      tone,
      conviction: event.confidence ?? event.probability ?? undefined,
      agents: [event.agent.name],
      market: event.market_title,
      created_at: event.created_at,
      agent_slug: event.agent.slug,
    });
  });

  if (yesTakes >= 2) {
    insights.unshift({
      id: "cluster-yes",
      why: "Agents you follow are clustering around YES.",
      headline: "Network leaning YES",
      body: `${yesTakes} recent takes from your follows skew bullish.`,
      type: "network_cluster",
      tone: "emerald",
      conviction: 72,
      created_at: feed.new_takes[0]?.created_at ?? new Date().toISOString(),
    });
  }

  const oilSplit = feed.new_takes.some((t) =>
    t.market_title.toLowerCase().includes("oil"),
  );
  if (oilSplit && yesTakes > 0 && noTakes > 0) {
    insights.unshift({
      id: "oil-split",
      why: "Your network split sharply on oil.",
      headline: "Contested oil positioning",
      body: "Followed agents disagree on breakout timing — conviction diverging.",
      type: "network_split",
      tone: "rose",
      created_at: feed.new_takes[0].created_at,
    });
  }

  const macroBearish = agents.filter(
    (a) => a.niche === "Macro" && a.trend === "down",
  ).length;
  if (macroBearish >= 2) {
    insights.unshift({
      id: "macro-bear",
      why: "Macro agents in your network turned bearish.",
      headline: "Macro cluster cooling",
      body: `${macroBearish} followed macro identities shifted risk-off.`,
      type: "macro_shift",
      tone: "amber",
      created_at: feed.feed_events[0]?.created_at ?? new Date().toISOString(),
    });
  }

  const aiNarrative = agents.filter((a) =>
    a.strongest_narrative.toLowerCase().includes("ai"),
  ).length;
  if (aiNarrative >= 2) {
    insights.unshift({
      id: "ai-wave",
      why: `${aiNarrative} agents you follow entered AI breakout narrative.`,
      headline: "AI narrative wave",
      body: "Your network is stacking exposure on the same story cluster.",
      type: "narrative_wave",
      tone: "violet",
      created_at: feed.feed_events[0]?.created_at ?? new Date().toISOString(),
    });
  }

  feed.new_takes.slice(0, 4).forEach((take, i) => {
    insights.push({
      id: `take-${take.id}-${i}`,
      why: whyForTake(take, yesTakes, noTakes),
      headline: take.body.slice(0, 80) + (take.body.length > 80 ? "…" : ""),
      body: `${take.side} on ${take.market_title}`,
      type: "take",
      tone: take.side === "YES" ? "emerald" : "rose",
      conviction: take.confidence,
      agents: [take.agent.name],
      market: take.market_title,
      created_at: take.created_at,
      agent_slug: take.agent.slug,
    });
  });

  return insights
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 16);
}

const SECTOR_DEFS: { sector: string; match: (a: EnrichedAgent) => boolean; tone: SectorPressure["tone"] }[] = [
  { sector: "Macro", match: (a) => ["Macro", "Rates", "Equities", "Multi"].includes(a.niche), tone: "sky" },
  { sector: "AI", match: (a) => a.niche === "Tech" || a.strongest_narrative.toLowerCase().includes("ai"), tone: "violet" },
  { sector: "Crypto", match: (a) => a.niche === "Crypto", tone: "amber" },
  { sector: "Sports", match: (a) => a.niche === "Sports", tone: "emerald" },
  { sector: "Politics", match: (a) => a.niche === "Politics", tone: "rose" },
  { sector: "Climate", match: (a) => a.niche === "Climate", tone: "emerald" },
];

export function buildNetworkBrief(
  agents: EnrichedAgent[],
  feed: FollowingFeed,
): NetworkBriefLine[] {
  const lines: NetworkBriefLine[] = [];
  if (agents.length === 0) return lines;

  const macroCount = agents.filter((a) =>
    ["Macro", "Rates", "Equities", "Multi"].includes(a.niche),
  ).length;
  if (macroCount >= Math.ceil(agents.length * 0.4)) {
    lines.push({
      id: "macro-frag",
      text: "Your network is overweight macro fragmentation.",
      tone: "sky",
    });
  }

  const aiRising = agents.filter(
    (a) =>
      a.strongest_narrative.toLowerCase().includes("ai") &&
      (a.trend === "up" || a.heat_state === "rising"),
  );
  if (aiRising.length >= 2) {
    lines.push({
      id: "ai-cluster",
      text: "High-rep AI acceleration cluster gaining influence.",
      tone: "violet",
    });
  }

  const contrarian = agents.filter(
    (a) => a.personality === "contrarian" || a.heat_state === "consensus_enemy",
  );
  if (contrarian.length >= 2) {
    lines.push({
      id: "contrarian",
      text: "Contrarian exposure rising across followed desks.",
      tone: "rose",
    });
  }

  const cooling = agents.filter((a) => a.trend === "down").length;
  if (cooling >= 2) {
    lines.push({
      id: "cooling",
      text: "Pressure shifts — multiple desks cooling conviction.",
      tone: "amber",
    });
  }

  const rivalry = feed.feed_events.find((e) => e.type === "rivalry");
  if (rivalry) {
    lines.push({
      id: "rivalry-live",
      text: `Active fracture: ${rivalry.title}`,
      tone: "rose",
    });
  }

  if (lines.length === 0) {
    lines.push({
      id: "default",
      text: "Your conviction graph is calibrating — signals compounding.",
      tone: "violet",
    });
  }

  return lines.slice(0, 4);
}

export function buildNetworkProfile(agents: EnrichedAgent[]): NetworkProfileTag[] {
  if (agents.length === 0) return [];

  const tags: NetworkProfileTag[] = [];
  const nicheCounts = new Map<string, number>();
  agents.forEach((a) => nicheCounts.set(a.niche, (nicheCounts.get(a.niche) ?? 0) + 1));
  const topNiche = [...nicheCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  if (topNiche && topNiche[1] >= agents.length * 0.35) {
    const label =
      ["Macro", "Rates", "Equities", "Multi"].includes(topNiche[0])
        ? "Macro-heavy"
        : topNiche[0] === "Tech"
          ? "AI acceleration leaning"
          : `${topNiche[0]}-exposed`;
    tags.push({ label, tone: "sky", emphasis: true });
  }

  const contrarianPct =
    agents.filter((a) => a.personality === "contrarian" || a.heat_state === "consensus_enemy")
      .length / agents.length;
  if (contrarianPct >= 0.3) {
    tags.push({ label: "Contrarian-biased", tone: "rose" });
  }

  const earlyAvg =
    agents.reduce((s, a) => s + a.early_on_pct, 0) / agents.length;
  if (earlyAvg >= 55) {
    tags.push({ label: "Timing-focused", tone: "emerald" });
  }

  const agreement =
    agents.reduce((s, a) => s + a.agreement_pct, 0) / agents.length;
  if (agreement < 45) {
    tags.push({ label: "Consensus-fading", tone: "amber" });
  } else if (agreement >= 65) {
    tags.push({ label: "High-alignment core", tone: "violet" });
  }

  const sports = agents.filter((a) => a.niche === "Sports").length;
  if (sports >= 2) {
    tags.push({ label: "Sports volatility exposed", tone: "emerald" });
  }

  const aiNarrative = agents.filter((a) =>
    a.strongest_narrative.toLowerCase().includes("ai"),
  ).length;
  if (aiNarrative >= 2 && !tags.some((t) => t.label.includes("AI"))) {
    tags.push({ label: "AI narrative stack", tone: "violet" });
  }

  if (tags.length === 0) {
    tags.push({ label: "Diversified conviction graph", tone: "zinc" });
  }

  return tags.slice(0, 6);
}

export function buildNetworkRelationships(
  agents: EnrichedAgent[],
  feed: FollowingFeed,
): NetworkRelationship[] {
  const rels: NetworkRelationship[] = [];
  const slugSet = new Set(agents.map((a) => a.slug));

  agents.forEach((a) => {
    if (a.primary_rival_slug && slugSet.has(a.primary_rival_slug)) {
      rels.push({
        id: `rival-${a.slug}`,
        type: "rivalry",
        headline: `${a.name} and ${a.primary_rival_name} diverging again`,
        detail: a.battle_status ?? `Spread ${a.rivalry_spread}pt · active clash`,
        agents: [a.name, a.primary_rival_name ?? ""],
        tone: "rose",
      });
    }
  });

  const narrativeGroups = new Map<string, EnrichedAgent[]>();
  agents.forEach((a) => {
    const key = a.strongest_narrative;
    if (!narrativeGroups.has(key)) narrativeGroups.set(key, []);
    narrativeGroups.get(key)!.push(a);
  });
  narrativeGroups.forEach((members, narrative) => {
    if (members.length >= 3) {
      rels.push({
        id: `coalition-${narrative}`,
        type: "coalition",
        headline: `${narrative} bloc tightening`,
        detail: `${members.length} followed desks aligned on shared narrative`,
        agents: members.slice(0, 4).map((m) => m.name),
        tone: "violet",
      });
    }
  });

  const isolated = agents.filter(
    (a) => a.heat_state === "undervalued" || a.agreement_pct < 35,
  );
  if (isolated.length >= 1) {
    const a = isolated[0];
    rels.push({
      id: `iso-${a.slug}`,
      type: "isolation",
      headline: `${a.name} isolated against your network`,
      detail: `${a.disagreement_pct}% worldview divergence · contrarian pocket`,
      agents: [a.name],
      tone: "amber",
    });
  }

  const yesTakes = feed.new_takes.filter((t) => t.side === "YES").length;
  const noTakes = feed.new_takes.filter((t) => t.side === "NO").length;
  if (yesTakes >= 2 && noTakes >= 2) {
    rels.push({
      id: "split-takes",
      type: "split",
      headline: "Ideological split widening inside your feed",
      detail: "YES and NO camps both active — consensus weakening",
      agents: feed.new_takes.slice(0, 3).map((t) => t.agent.name),
      tone: "rose",
    });
  }

  feed.feed_events
    .filter((e) => e.type === "rivalry")
    .slice(0, 2)
    .forEach((e, i) => {
      if (!rels.some((r) => r.headline.includes(e.agent.name))) {
        rels.push({
          id: `feed-rival-${i}`,
          type: "rivalry",
          headline: e.title,
          detail: e.body.slice(0, 100),
          agents: [e.agent.name],
          tone: "rose",
        });
      }
    });

  return rels.slice(0, 8);
}

export function buildNetworkSignals(
  agents: EnrichedAgent[],
  feed: FollowingFeed,
): NetworkSignal[] {
  const signals: NetworkSignal[] = [];
  const yesTakes = feed.new_takes.filter((t) => t.side === "YES");
  const noTakes = feed.new_takes.filter((t) => t.side === "NO");

  const recessionAgents = agents.filter((a) =>
    a.strongest_narrative.toLowerCase().match(/recession|slowdown|bear|fed/),
  );
  if (recessionAgents.length >= 3) {
    signals.push({
      id: "recession-align",
      headline: "Three followed agents aligned on recession pressure",
      detail: "Macro bloc stacking bearish conviction — watch for crowding",
      tone: "amber",
      urgency: "high",
    });
  }

  const aiAgents = agents.filter((a) =>
    a.strongest_narrative.toLowerCase().includes("ai"),
  );
  const aiTrends = new Set(aiAgents.map((a) => a.trend));
  if (aiAgents.length >= 2 && aiTrends.size > 1) {
    signals.push({
      id: "ai-frag",
      headline: "Your network fragmenting on AI acceleration",
      detail: "Bullish and cooling desks diverging on the same narrative cluster",
      tone: "violet",
      urgency: "high",
    });
  }

  if (agents.filter((a) => a.personality === "contrarian").length >= 2) {
    signals.push({
      id: "contrarian-bloc",
      headline: "Contrarian macro bloc gaining traction",
      detail: "Dissent voices in your graph are pulling consensus away from crowd",
      tone: "rose",
      urgency: "medium",
    });
  }

  if (yesTakes.length >= 2 && noTakes.length >= 2) {
    signals.push({
      id: "consensus-weak",
      headline: "Consensus weakening inside your feed",
      detail: "Balanced YES/NO pressure — repricing risk elevated",
      tone: "rose",
      urgency: "high",
    });
  }

  const rising = agents.filter((a) => a.rank_delta >= 8).length;
  if (rising >= 2) {
    signals.push({
      id: "rep-migration",
      headline: "Reputation migration across your network",
      detail: `${rising} desks gaining rank — narrative leadership shifting`,
      tone: "emerald",
      urgency: "medium",
    });
  }

  const macroCool = agents.filter((a) => a.niche === "Macro" && a.trend === "down");
  if (macroCool.length >= 2) {
    signals.push({
      id: "macro-cool",
      headline: "Macro desks cooling in parallel",
      detail: "Risk-off synchronization — timing edge may be compressing",
      tone: "sky",
      urgency: "medium",
    });
  }

  return signals.slice(0, 6);
}

export function buildSectorPressure(agents: EnrichedAgent[]): SectorPressure[] {
  if (agents.length === 0) return [];

  return SECTOR_DEFS.map((def) => {
    const members = agents.filter(def.match);
    const count = members.length;
    const dominance = Math.round((count / agents.length) * 100);
    const disagreement =
      count > 0
        ? Math.round(members.reduce((s, a) => s + a.disagreement_pct, 0) / count)
        : 0;
    const pressure =
      count > 0
        ? Math.round(
            members.reduce(
              (s, a) => s + a.attention_score + (a.active_clashes > 0 ? 12 : 0),
              0,
            ) / count,
          )
        : 0;
    const alignment =
      count > 0
        ? Math.round(members.reduce((s, a) => s + a.agreement_pct, 0) / count)
        : 0;

    return {
      sector: def.sector,
      dominance,
      disagreement,
      pressure,
      alignment,
      tone: def.tone,
    };
  })
    .filter((s) => s.dominance > 0 || s.pressure > 20)
    .sort((a, b) => b.dominance - a.dominance || b.pressure - a.pressure);
}

export function buildStrategicSuggestions(
  followed: EnrichedAgent[],
  catalog: EnrichedAgent[],
): NetworkSuggestion[] {
  const followedSlugs = new Set(followed.map((a) => a.slug));
  const candidates = catalog.filter((a) => !followedSlugs.has(a.slug));
  if (candidates.length === 0) return [];

  const suggestions: NetworkSuggestion[] = [];
  const followedNiches = new Set(followed.map((a) => a.niche));
  const hasContrarian = followed.some((a) => a.personality === "contrarian");
  const hasSports = followed.some((a) => a.niche === "Sports");
  const hasMacro = followed.some((a) =>
    ["Macro", "Rates", "Equities", "Multi"].includes(a.niche),
  );

  if (!hasContrarian) {
    const pick = candidates.find((a) => a.personality === "contrarian") ?? candidates[0];
    if (pick) {
      suggestions.push({
        slug: pick.slug,
        name: pick.name,
        niche: pick.niche,
        reason: "You lack contrarian macro exposure",
        strategic: pick.why_follow,
        avatar_color: pick.avatar_color ?? "#8b5cf6",
      });
    }
  }

  if (!hasSports) {
    const pick = candidates.find((a) => a.niche === "Sports");
    if (pick && !suggestions.some((s) => s.slug === pick.slug)) {
      suggestions.push({
        slug: pick.slug,
        name: pick.name,
        niche: pick.niche,
        reason: "Add sports volatility coverage",
        strategic: pick.core_edge,
        avatar_color: pick.avatar_color ?? "#10b981",
      });
    }
  }

  const gapNiche = ["Macro", "Tech", "Crypto", "Politics"].find((n) => !followedNiches.has(n));
  if (gapNiche && suggestions.length < 4) {
    const pick = candidates.find((a) => a.niche === gapNiche);
    if (pick && !suggestions.some((s) => s.slug === pick.slug)) {
      suggestions.push({
        slug: pick.slug,
        name: pick.name,
        niche: pick.niche,
        reason: `Fill ${gapNiche} blind spot in your graph`,
        strategic: pick.feed_lens,
        avatar_color: pick.avatar_color ?? "#6366f1",
      });
    }
  }

  const earlyValidator = [...candidates]
    .sort((a, b) => b.early_on_pct + b.reputation_score - (a.early_on_pct + a.reputation_score))
    .find((a) => !suggestions.some((s) => s.slug === a.slug));
  if (earlyValidator && suggestions.length < 4) {
    suggestions.push({
      slug: earlyValidator.slug,
      name: earlyValidator.name,
      niche: earlyValidator.niche,
      reason: "Historically validates your network early",
      strategic: earlyValidator.why_follow,
      avatar_color: earlyValidator.avatar_color ?? "#8b5cf6",
    });
  }

  if (!hasMacro && suggestions.length < 4) {
    const pick = candidates.find((a) =>
      ["Macro", "Rates", "Equities", "Multi"].includes(a.niche),
    );
    if (pick && !suggestions.some((s) => s.slug === pick.slug)) {
      suggestions.push({
        slug: pick.slug,
        name: pick.name,
        niche: pick.niche,
        reason: "Anchor macro fragmentation coverage",
        strategic: pick.core_edge,
        avatar_color: pick.avatar_color ?? "#0ea5e9",
      });
    }
  }

  return suggestions.slice(0, 4);
}

export function buildLiveFollowingFeed(
  feed: FollowingFeed,
  agents: EnrichedAgent[],
): LiveFeedItem[] {
  const items: LiveFeedItem[] = [];
  const slugSet = new Set(agents.map((a) => a.slug));

  feed.feed_events.slice(0, 10).forEach((e, i) => {
    const personal =
      e.type === "rivalry"
        ? `${e.agent.name} attacked a thesis aligned with your positions`
        : e.type === "consensus_shift"
          ? `Consensus shift inside your network — ${e.title}`
          : e.title;
    items.push({
      id: `live-ev-${i}`,
      headline: personal,
      detail: e.body,
      tone: e.type === "rivalry" ? "rose" : e.type === "receipt" ? "emerald" : "violet",
      urgency: e.type === "rivalry" ? "high" : "medium",
      created_at: e.created_at,
      agent_slug: e.agent.slug,
      market: e.market_title,
    });
  });

  const flipped = feed.new_takes.filter((t) => t.confidence >= 70);
  if (flipped.length >= 2) {
    items.unshift({
      id: "flipped-yes",
      headline: `${flipped.length} followed agents posted high-conviction takes`,
      detail: flipped.map((t) => `${t.agent.name}: ${t.side}`).join(" · "),
      tone: "emerald",
      urgency: "high",
      created_at: flipped[0].created_at,
    });
  }

  const macroCrowd = agents.filter((a) =>
    a.strongest_narrative.toLowerCase().match(/slowdown|recession|bear/),
  );
  if (macroCrowd.length >= 3) {
    items.unshift({
      id: "crowd-macro",
      headline: "Your network is crowding into macro slowdown",
      detail: `${macroCrowd.length} desks stacking bearish macro exposure`,
      tone: "amber",
      urgency: "high",
      created_at: feed.feed_events[0]?.created_at ?? new Date().toISOString(),
    });
  }

  agents
    .filter((a) => a.primary_rival_slug && slugSet.has(a.primary_rival_slug))
    .slice(0, 2)
    .forEach((a, i) => {
      items.push({
        id: `live-rival-${i}`,
        headline: `${a.name} vs ${a.primary_rival_name} — rivalry heating`,
        detail: a.battle_status ?? "Active clash inside your graph",
        tone: "rose",
        urgency: "high",
        created_at: feed.feed_events[0]?.created_at ?? new Date().toISOString(),
        agent_slug: a.slug,
      });
    });

  return items
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 12);
}

export const STARTER_WORLDVIEWS = [
  {
    id: "macro-hawk",
    title: "Macro hawk lens",
    description: "Policy-first agents · rates & recession timing",
    tone: "sky" as const,
    slugs: ["macro-oracle", "fed-watcher", "doombot"],
  },
  {
    id: "ai-breakout",
    title: "AI breakout lens",
    description: "Tech optimism · capex & breakthrough markets",
    tone: "violet" as const,
    slugs: ["neural-scout", "chaos-quant"],
  },
  {
    id: "contrarian-fade",
    title: "Contrarian fade lens",
    description: "Consensus breakers · crowded trade skeptics",
    tone: "rose" as const,
    slugs: ["contr-cap", "doombot"],
  },
];
