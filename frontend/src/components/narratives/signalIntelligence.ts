import type {
  BeforeConsensusRecord,
  Coalition,
  EnrichedNarrative,
  HeatmapCell,
  HiddenAlignment,
  LifecyclePhase,
  MomentumRow,
  NarrativeItem,
  PressureDirection,
  PulseItem,
  RadarCard,
  SignalStage,
} from "./types";




function hashSeed(...parts: string[]) {

  return parts.join("").split("").reduce((a, c) => a + c.charCodeAt(0), 0);

}



const STAGES: SignalStage[] = [

  "FORMING",

  "CLUSTERING",

  "CONTESTED",

  "BREAKOUT",

  "MAINSTREAM",

  "COLLAPSING",

];



const LIFECYCLES: LifecyclePhase[] = [

  "WEAK_SIGNAL",

  "CLUSTERING",

  "PRESSURE_BUILDING",

  "CONSENSUS_BREAK",

  "REPRICING",

  "DOMINANT_NARRATIVE",

  "COLLAPSE",

];



const PRESSURES: PressureDirection[] = [

  "accelerating",

  "collapsing",

  "aligning",

  "fragmenting",

  "repricing",

  "tightening",

  "migrating",

  "concentrating",

];



const EARLY_COPY = [

  "low-correlation agents aligned on soft landing risk",

  "high-rep desks quietly shifting toward YES",

  "volatility cluster widening before repricing",

  "contrarian macro bloc forming",

  "cross-sector convergence detected at low volume",

  "synchronized thesis rotation across independent agents",

  "stealth clustering on liquidity slowdown thesis",

  "reputation-weighted agreement forming below radar",

];



const RADAR_NARRATIVES = [

  "AI acceleration cluster tightening",

  "Macro desks fragmenting",

  "Sports injury panic forming",

  "Crypto momentum dispersing",

  "Fed path consensus collapsing",

  "Politics volatility migrating",

  "Climate policy pressure concentrating",

  "Tech earnings alignment unusual",

];



type SignalBase = Pick<
  EnrichedNarrative,
  "id" | "velocity" | "is_contrarian" | "alignment"
>;

export function deriveSignalFields(
  item: NarrativeItem,
  _index: number,
  _source: EnrichedNarrative["source"],
  base: SignalBase,
) {

  const h = hashSeed(base.id, item.title);

  const signal_stage = STAGES[h % STAGES.length];

  const lifecycle_phase = LIFECYCLES[Math.min(Math.floor(base.velocity / 3), LIFECYCLES.length - 1)];

  const pressure_direction = PRESSURES[h % PRESSURES.length];

  const rep_weight = 42 + (h % 48) + item.agents_involved.length * 4;

  const coordination_score = base.is_contrarian

    ? 18 + (h % 25)

    : 55 + (h % 35) + item.agents_involved.length * 3;



  return {

    signal_stage,

    lifecycle_phase,

    pressure_direction,

    confidence_density: Math.min(98, item.strength * 0.7 + base.alignment * 0.25),

    rep_weight,

    spread_velocity: item.change * 1.2 + (h % 7) * 0.4,

    narrative_acceleration: base.velocity,

    coordination_score,

    cluster_size: item.agents_involved.length + item.markets_involved.length,

    early_signal_copy: EARLY_COPY[h % EARLY_COPY.length],

  };

}



export function buildRadarCards(narratives: EnrichedNarrative[]): RadarCard[] {

  const pool = narratives.length >= 6 ? narratives : narratives;

  const cards: RadarCard[] = RADAR_NARRATIVES.map((narrative, i) => {

    const n = pool[i % Math.max(pool.length, 1)];

    const h = hashSeed(narrative, String(i));

    return {

      id: `radar-${i}`,

      narrative,

      pressure_direction: PRESSURES[h % PRESSURES.length],

      acceleration_score: 52 + (h % 42),

      rep_density: 38 + (h % 55),

      sectors: n ? [n.category, ...(i % 2 ? ["Markets"] : [])] : ["Macro"],

      signal_stage: STAGES[(h + i) % STAGES.length],

      seed: `radar-${i}-${n?.id ?? "x"}`,

    };

  });

  return cards.slice(0, 8);

}



export function buildHiddenAlignments(narratives: EnrichedNarrative[]): HiddenAlignment[] {

  const templates = [

    "Three macro agents independently rotated YES within 4h.",

    "Cross-sector AI acceleration alignment detected.",

    "Sports and macro desks converging on liquidity slowdown.",

    "Low-volume high-rep agreement on Fed cut timing.",

    "Repeated thesis pattern across uncorrelated agents.",

    "Stealth clustering on recession timing repricing.",

  ];

  return templates.map((copy, i) => {

    const n = narratives[i % Math.max(narratives.length, 1)];

    const h = hashSeed(copy, String(i));

    return {

      id: `hidden-${i}`,

      copy,

      agents: n?.driver_agents.slice(0, 3) ?? ["macro-oracle", "fed-watcher", "contr-cap"],

      sectors: n ? [n.category, "Markets"] : ["Macro", "AI"],

      coordination_score: 72 + (h % 22),

      rep_weight: 68 + (h % 28),

      detected_at: n?.created_at ?? new Date().toISOString(),

    };

  }).slice(0, 5);

}



export function buildCoalitions(narratives: EnrichedNarrative[]): Coalition[] {

  const defs = [

    { name: "AI melt-up cluster", narratives: ["AI optimism accelerating", "ETF demand supercycle"] },

    { name: "Recession bloc", narratives: ["Soft landing weakening", "Fed cut timing pulled forward"] },

    { name: "Sports panic desks", narratives: ["Sports upset momentum"] },

    { name: "Soft landing coalition", narratives: ["Soft landing weakening"] },

    { name: "Crypto breakout camp", narratives: ["Crypto liquidity repricing"] },

  ];

  return defs.map((d, i) => {

    const linked = narratives.filter((n) =>

      d.narratives.some((t) => n.title.toLowerCase().includes(t.toLowerCase().slice(0, 12))),

    );

    const n = linked[0] ?? narratives[i % Math.max(narratives.length, 1)];

    const h = hashSeed(d.name, String(i));

    const members =

      n?.driver_agents.length >= 2

        ? n.driver_agents

        : ["bullbot", "macro-oracle", "chaos-quant", "fed-watcher"].slice(0, 3 + (i % 2));

    return {

      id: `coalition-${i}`,

      name: d.name,

      members,

      shared_narratives: d.narratives,

      pressure_direction: PRESSURES[(h + i) % PRESSURES.length],

      influence_score: 58 + (h % 38),

      internal_agreement: n ? n.alignment : 45 + (h % 40),

      growth_rate: 6 + (h % 18) + (n?.velocity ?? 4) * 0.5,

    };

  });

}



const HEATMAP_SECTORS = [

  "Macro",

  "AI",

  "Crypto",

  "Politics",

  "Sports",

  "Climate",

  "Tech",

  "Markets",

];



export function buildHeatmap(

  narratives: EnrichedNarrative[],

  momentum: MomentumRow[],

): HeatmapCell[] {

  return HEATMAP_SECTORS.map((sector) => {

    const sectorNarratives = narratives.filter(

      (n) => n.category === sector || (sector === "Markets" && n.cluster_markets.length > 1),

    );

    const mom = momentum.find((m) => m.category === sector);

    const h = hashSeed(sector, String(sectorNarratives.length));

    const avgVel =

      sectorNarratives.reduce((s, n) => s + n.velocity, 0) /

      Math.max(sectorNarratives.length, 1);

    const avgAlign =

      sectorNarratives.reduce((s, n) => s + n.alignment, 0) /

      Math.max(sectorNarratives.length, 1);



    return {

      sector,

      pressure: mom?.change ?? avgVel ?? 4 + (h % 8),

      fragmentation: sectorNarratives.some((n) => n.is_contrarian)

        ? 55 + (h % 35)

        : 12 + (h % 20),

      consensus: avgAlign || mom?.strength || 40 + (h % 45),

      volatility_migration: (mom?.agent_count ?? 6) + (h % 12),

    };

  });

}



export function buildBeforeConsensus(narratives: EnrichedNarrative[]): BeforeConsensusRecord[] {

  const records = [

    {

      signal_copy: "Fed cut by Sep 2026 appeared here 11d before repricing.",

      market: "Fed cut by Sep 2026",

      lead_days: 11,

      outcome: "Consensus pulled forward · median YES +14pt",

      sector: "Macro",

    },

    {

      signal_copy: "AI acceleration fragmentation detected before mainstream breakout.",

      market: "Major AI breakthrough before December",

      lead_days: 8,

      outcome: "Cluster tightened · velocity +9.2",

      sector: "AI",

    },

    {

      signal_copy: "Sports injury cluster surfaced before odds shift.",

      market: "Champions League final upset",

      lead_days: 6,

      outcome: "Upset probability band widened · verified overlap",

      sector: "Sports",

    },

    {

      signal_copy: "Crypto momentum dispersal flagged before liquidity repricing.",

      market: "BTC above 150k by year end",

      lead_days: 9,

      outcome: "Spread refused convergence · fracture held",

      sector: "Crypto",

    },

  ];



  return records.map((r, i) => {

    const n =

      narratives.find((x) =>

        x.cluster_markets.some((m) => m.toLowerCase().includes(r.market.toLowerCase().slice(0, 8))),

      ) ?? narratives[i % Math.max(narratives.length, 1)];

    return {

      id: `verified-${i}`,

      signal_copy: r.signal_copy,

      lead_days: r.lead_days,

      first_agents: n?.driver_agents.slice(0, 3) ?? ["macro-oracle", "fed-watcher"],

      consensus_at_birth: 22 + (hashSeed(r.signal_copy) % 28),

      eventual_outcome: r.outcome,

      rep_impact: 12 + (hashSeed(r.outcome) % 24),

      sector: r.sector,

    };

  });

}



export function buildPulseItems(narratives: EnrichedNarrative[]): PulseItem[] {

  const items: PulseItem[] = [

    { id: "p1", copy: "Coalition growth · AI melt-up +3 agents", tone: "amber", time_ago: "2m" },

    { id: "p2", copy: "Fragmentation alert · macro desks diverging", tone: "violet", time_ago: "5m" },

    { id: "p3", copy: "Rep migration · high-rep cluster shifting YES", tone: "teal", time_ago: "8m" },

    { id: "p4", copy: "Verification momentum · Fed cut signal forming", tone: "emerald", time_ago: "12m" },

    { id: "p5", copy: "Narrative acceleration · sports panic cluster", tone: "rose", time_ago: "18m" },

    { id: "p6", copy: "Pressure shift · crypto dispersion widening", tone: "amber", time_ago: "24m" },

  ];

  if (narratives[0]) {

    items[0] = {

      ...items[0],

      copy: `Pressure shift · ${narratives[0].title.slice(0, 32)}…`,

    };

  }

  return items;

}



export function buildLifecycleDistribution(narratives: EnrichedNarrative[]) {

  const counts = new Map<LifecyclePhase, number>();

  for (const n of narratives) {

    counts.set(n.lifecycle_phase, (counts.get(n.lifecycle_phase) ?? 0) + 1);

  }

  return counts;

}



export function categoryMatchesTech(title: string, markets: string[]): boolean {

  const blob = `${title} ${markets.join(" ")}`.toLowerCase();

  return /tech|nvda|earnings|etf|semiconductor/i.test(blob);

}



export function categoryMatchesMarkets(title: string, markets: string[]): boolean {

  return markets.length >= 2 || /market|liquidity|repric/i.test(title.toLowerCase());

}


