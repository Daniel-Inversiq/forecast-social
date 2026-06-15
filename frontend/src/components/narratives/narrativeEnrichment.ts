import { titleToSlug } from "@/lib/slugs";
import { deriveSignalFields } from "./signalIntelligence";
import type {
  EnrichedNarrative,
  MomentumRow,
  NarrativeFilterKey,
  NarrativeItem,
  NarrativesPayload,
  NarrativeSortKey,
  SignalInsight,
} from "./types";

function hashSeed(...parts: string[]) {
  return parts.join("").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

export function inferCategory(title: string, markets: string[]): string {
  const blob = `${title} ${markets.join(" ")}`.toLowerCase();
  if (/ai|neural|breakthrough/i.test(blob)) return "AI";
  if (/crypto|btc|eth/i.test(blob)) return "Crypto";
  if (/fed|recession|macro|soft|landing|rates|oil|energy/i.test(blob)) return "Macro";
  if (/election|politic|debate|incumbent/i.test(blob)) return "Politics";
  if (/sport|league|upset|football|champion/i.test(blob)) return "Sports";
  if (/climate|carbon|regulation|policy shift/i.test(blob)) return "Climate";
  if (/tech|semiconductor|software/i.test(blob)) return "Tech";
  if (/market|liquidity|repric|etf/i.test(blob)) return "Markets";
  if (/nvda|earnings|equit/i.test(blob)) return "Tech";
  return "Macro";
}

const MOMENTUM_LABEL: Record<string, string> = {
  up: "Accelerating",
  down: "Cooling",
  split: "Fracturing",
};

export function enrichNarrative(
  item: NarrativeItem,
  index: number,
  source: EnrichedNarrative["source"],
): EnrichedNarrative {
  const id = `${source}-${titleToSlug(item.title)}-${index}`;
  const h = hashSeed(id, item.title);
  const category = inferCategory(item.title, item.markets_involved);
  const velocity = item.change + (h % 5) * 0.3;
  const alignment =
    item.type === "disagreement" || item.direction === "split"
      ? 28 + (h % 22)
      : 62 + (h % 28);
  const market_slugs = item.markets_involved.map(titleToSlug);
  const hoursAgo = (Date.now() - new Date(item.created_at).getTime()) / 3600000;

  const whats_changing =
    item.type === "consensus_shift"
      ? `Agent cluster repricing ${item.markets_involved[0] ?? "linked markets"} — median conviction drifting ${item.direction === "up" ? "higher" : "lower"} with ${item.change.toFixed(1)}pt velocity.`
      : item.type === "disagreement"
        ? `Conviction fracture widening across ${item.agents_involved.length} agents — spread refusing convergence on ${item.markets_involved[0] ?? "contested markets"}.`
        : `Narrative momentum ${item.direction === "up" ? "heating" : item.direction === "down" ? "decelerating" : "splitting"} — ${item.change.toFixed(1)}pt narrative velocity in ${category}.`;

  const why_matters =
    item.description.length > 120
      ? item.description
      : `${item.description} Network alignment at ${alignment}% — ${item.agents_involved.length} agents driving repricing across ${item.markets_involved.length} markets.`;

  const primaryMarket = item.markets_involved[0];
  const slug = primaryMarket ? titleToSlug(primaryMarket) : "markets";

  const base = {
    ...item,
    id,
    category,
    velocity,
    alignment,
    momentum_label: MOMENTUM_LABEL[item.direction] ?? "In motion",
    whats_changing,
    why_matters,
    driver_agents: item.agents_involved.slice(0, 5),
    market_slugs,
    linked_battles: item.agents_involved.length >= 2
      ? [
          {
            label: `${item.agents_involved[0]} vs ${item.agents_involved[1]}`,
            href: `/battles`,
          },
        ]
      : [{ label: "View conviction battles", href: "/battles" }],
    linked_verified:
      item.type === "narrative_breakout" || item.title.toLowerCase().includes("receipt")
        ? [{ label: "Verified overlap", href: "/verified-calls" }]
        : [{ label: "Early calls on cluster", href: "/verified-calls" }],
    cluster_markets: item.markets_involved,
    is_live: hoursAgo < 8 || item.change >= 8,
    is_contrarian: item.type === "disagreement" || item.direction === "split",
    is_emerging:
      item.type === "narrative_breakout" || item.strength < 65 || item.type === "consensus_shift",
    is_breaking: item.change >= 9 || hoursAgo < 2,
    verified_score: item.type === "narrative_breakout" ? item.strength + 8 : item.strength * 0.6,
    discuss_score: item.agents_involved.length * 12 + item.markets_involved.length * 8 + (h % 20),
    source,
  };

  return { ...base, ...deriveSignalFields(item, index, source, base) };
}

export function buildEnrichedList(payload: NarrativesPayload): EnrichedNarrative[] {
  const seen = new Set<string>();
  const out: EnrichedNarrative[] = [];

  const add = (items: NarrativeItem[], source: EnrichedNarrative["source"]) => {
    items.forEach((item, i) => {
      const key = item.title.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(enrichNarrative(item, i, source));
    });
  };

  add(payload.trending_narratives, "trending");
  add(payload.consensus_shifts, "shift");
  add(payload.expanding_disagreements, "disagreement");

  return out.sort((a, b) => b.velocity - a.velocity);
}

export function categoryFromMomentum(row: MomentumRow): string {
  return row.category;
}

const FILTER_FN: Record<NarrativeFilterKey, (n: EnrichedNarrative) => boolean> = {
  all: () => true,
  macro: (n) => n.category === "Macro",
  politics: (n) => n.category === "Politics",
  crypto: (n) => n.category === "Crypto",
  ai: (n) => n.category === "AI",
  sports: (n) => n.category === "Sports",
  climate: (n) => n.category === "Climate",
  tech: (n) => n.category === "Tech",
  markets: (n) => n.category === "Markets" || n.cluster_markets.length >= 2,
  forming: (n) => n.signal_stage === "FORMING" || n.signal_stage === "CLUSTERING",
  contrarian: (n) => n.is_contrarian,
  high_rep: (n) => n.rep_weight >= 72,
  accelerating: (n) => n.narrative_acceleration >= 8 || n.pressure_direction === "accelerating",
  fragmenting: (n) => n.is_contrarian || n.pressure_direction === "fragmenting",
  consensus_building: (n) => n.alignment >= 70 && !n.is_contrarian,
  before_consensus: (n) =>
    n.lifecycle_phase === "WEAK_SIGNAL" ||
    n.lifecycle_phase === "CLUSTERING" ||
    n.lifecycle_phase === "PRESSURE_BUILDING",
  verification_forming: (n) => n.verified_score >= 55 || n.signal_stage === "BREAKOUT",
};

export function filterNarratives(
  narratives: EnrichedNarrative[],
  filter: NarrativeFilterKey,
  query: string,
): EnrichedNarrative[] {
  const fn = FILTER_FN[filter] ?? FILTER_FN.all;
  const q = query.trim().toLowerCase();
  return narratives.filter((n) => {
    if (!fn(n)) return false;
    if (!q) return true;
    const blob = [n.title, n.description, n.category, ...n.cluster_markets, ...n.driver_agents]
      .join(" ")
      .toLowerCase();
    return blob.includes(q);
  });
}

export function sortNarratives(
  narratives: EnrichedNarrative[],
  sort: NarrativeSortKey,
): EnrichedNarrative[] {
  const copy = [...narratives];
  const lifecycleOrder = [
    "WEAK_SIGNAL",
    "CLUSTERING",
    "PRESSURE_BUILDING",
    "CONSENSUS_BREAK",
    "REPRICING",
    "DOMINANT_NARRATIVE",
    "COLLAPSE",
  ];
  switch (sort) {
    case "acceleration":
      return copy.sort((a, b) => b.narrative_acceleration - a.narrative_acceleration);
    case "coordination":
      return copy.sort((a, b) => b.coordination_score - a.coordination_score);
    case "rep_weight":
      return copy.sort((a, b) => b.rep_weight - a.rep_weight);
    case "earliest":
      return copy.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    case "lifecycle":
      return copy.sort(
        (a, b) =>
          lifecycleOrder.indexOf(a.lifecycle_phase) - lifecycleOrder.indexOf(b.lifecycle_phase),
      );
    case "pressure":
    default:
      return copy.sort((a, b) => b.spread_velocity - a.spread_velocity);
  }
}

export function buildSignalInsights(
  narratives: EnrichedNarrative[],
  momentum: MomentumRow[],
): SignalInsight[] {
  if (narratives.length === 0) return [];

  const fastest = [...narratives].sort((a, b) => b.velocity - a.velocity)[0];
  const fracture = [...narratives]
    .filter((n) => n.is_contrarian)
    .sort((a, b) => a.alignment - b.alignment)[0];
  const converging = [...narratives]
    .filter((n) => !n.is_contrarian)
    .sort((a, b) => b.alignment - a.alignment)[0];
  const contrarian = [...narratives]
    .filter((n) => n.is_contrarian)
    .sort((a, b) => b.velocity - a.velocity)[0];
  const verified = [...narratives].sort((a, b) => b.verified_score - a.verified_score)[0];
  const reversal = [...narratives]
    .filter((n) => n.direction === "down" || n.type === "momentum_down")
    .sort((a, b) => b.change - a.change)[0];
  const expansion = [...narratives]
    .filter((n) => n.type === "momentum_up")
    .sort((a, b) => b.alignment - a.alignment)[0];
  const hottestCluster = [...momentum].sort((a, b) => b.change - a.change)[0];

  const insights: SignalInsight[] = [
    {
      id: "rising",
      label: "Fastest rising signal",
      value: fastest.title,
      sub: `+${fastest.velocity.toFixed(1)} velocity · ${fastest.category}`,
      tone: "emerald",
      href: "/narratives",
    },
    {
      id: "fracture",
      label: "Consensus fracture",
      value: fracture?.title ?? "—",
      sub: fracture ? `${fracture.alignment}% alignment` : "",
      tone: "violet",
      href: fracture?.market_slugs[0] ? `/markets/${fracture.market_slugs[0]}` : undefined,
    },
    {
      id: "converge",
      label: "Narrative convergence",
      value: converging?.title ?? "—",
      sub: converging ? `${converging.alignment}% aligned` : "",
      tone: "sky",
    },
    {
      id: "contrarian",
      label: "Contrarian narrative",
      value: contrarian?.title ?? "—",
      sub: contrarian ? `${contrarian.driver_agents.length} agents diverging` : "",
      tone: "amber",
    },
    {
      id: "verified",
      label: "Most verified narrative",
      value: verified.title,
      sub: `${Math.round(verified.verified_score)} proof score`,
      tone: "cyan",
      href: "/verified-calls",
    },
    {
      id: "reversal",
      label: "Biggest narrative reversal",
      value: reversal?.title ?? fastest.title,
      sub: reversal ? `Cooling · ${reversal.change.toFixed(1)}pt` : "Momentum flip",
      tone: "rose",
    },
    {
      id: "expansion",
      label: "Alignment expansion",
      value: expansion?.title ?? converging?.title ?? "—",
      sub: expansion ? `+${expansion.change.toFixed(1)} clustering` : "",
      tone: "emerald",
    },
    {
      id: "cluster",
      label: "Market repricing cluster",
      value: hottestCluster?.category ?? "Macro",
      sub: hottestCluster
        ? `${hottestCluster.agent_count} agents · Δ${hottestCluster.change.toFixed(1)}`
        : "",
      tone: "sky",
      href: "/markets",
    },
  ];

  return insights;
}

export function buildHeroStats(
  narratives: EnrichedNarrative[],
  momentum: MomentumRow[],
) {
  const weak = narratives.filter((n) => n.lifecycle_phase === "WEAK_SIGNAL").length;
  const forming = narratives.filter(
    (n) => n.signal_stage === "FORMING" || n.signal_stage === "CLUSTERING",
  ).length;
  const fastest = [...narratives].sort((a, b) => b.narrative_acceleration - a.narrative_acceleration)[0];
  const hidden = [...narratives].sort((a, b) => b.coordination_score - a.coordination_score)[0];
  const fracture = [...narratives]
    .filter((n) => n.is_contrarian)
    .sort((a, b) => a.alignment - b.alignment)[0];
  const avgPressure =
    narratives.reduce((s, n) => s + n.spread_velocity, 0) / Math.max(narratives.length, 1);
  const hottestCluster = [...momentum].sort((a, b) => b.change - a.change)[0];

  return [
    {
      label: "Weak signals live",
      value: String(forming || weak || narratives.length),
      sub: `${weak} pre-consensus`,
      pulse: true,
    },
    {
      label: "Highest acceleration",
      value: fastest?.title ?? "—",
      sub: fastest ? `+${fastest.narrative_acceleration.toFixed(1)} accel` : "",
      highlight: true,
    },
    {
      label: "Hidden alignment forming",
      value: hidden?.title ?? "—",
      sub: hidden ? `${hidden.coordination_score}% coordination` : "",
    },
    {
      label: "Largest fracture",
      value: fracture?.title ?? "—",
      sub: fracture ? `${fracture.alignment}% consensus` : "",
    },
    {
      label: "Network pressure index",
      value: `${avgPressure.toFixed(1)}`,
      sub: "spread velocity avg",
    },
    {
      label: "Pressure concentration",
      value: hottestCluster?.category ?? "AI",
      sub: hottestCluster
        ? `${hottestCluster.agent_count} agents · Δ${hottestCluster.change.toFixed(1)}`
        : "",
      highlight: false,
    },
  ];
}

export const TYPE_STYLES: Record<
  string,
  { label: string; glow: string; badge: string; tone: string }
> = {
  momentum_up: {
    label: "Momentum ↑",
    glow: "narrative-glow-up",
    badge: "text-emerald-200 bg-emerald-500/12 border-emerald-500/30",
    tone: "emerald",
  },
  momentum_down: {
    label: "Cooling",
    glow: "narrative-glow-down",
    badge: "text-rose-200 bg-rose-500/12 border-rose-500/30",
    tone: "rose",
  },
  consensus_shift: {
    label: "Consensus shift",
    glow: "narrative-glow-sky",
    badge: "text-sky-200 bg-sky-500/12 border-sky-500/30",
    tone: "sky",
  },
  disagreement: {
    label: "Fracture",
    glow: "narrative-glow-violet",
    badge: "text-violet-200 bg-violet-500/12 border-violet-500/30",
    tone: "violet",
  },
  narrative_breakout: {
    label: "Breakout",
    glow: "narrative-glow-amber",
    badge: "text-amber-200 bg-amber-500/12 border-amber-500/30",
    tone: "amber",
  },
};
