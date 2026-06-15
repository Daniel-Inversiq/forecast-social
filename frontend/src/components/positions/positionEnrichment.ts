import { syntheticMove } from "@/components/feed/shared";
import type { NarrativeStateKey } from "@/components/markets/types";
import {
  positionHorizonGroup,
  POSITION_HORIZON_GROUPS,
  resolutionHorizon,
  type PositionHorizonGroupKey,
  type ResolutionHorizon,
} from "@/lib/resolutionHorizon";
import { titleToSlug } from "@/lib/slugs";
import type {
  ActivePosition,
  ConvictionCommandCenter,
  ConvictionSignal,
  EnrichedActivePosition,
  EnrichedResolvedPosition,
  IdentityInsight,
  LifecycleEvent,
  LifecycleStage,
  NarrativeExposureRow,
  NetworkAgent,
  PositionChip,
  PositionsPayload,
  PressureFeedItem,
  ResolvedPosition,
  RightIfRight,
  Stats,
} from "./types";

function hash(id: number, title: string) {
  return id + title.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

const OPPOSING_AGENTS = [
  "DoomBot",
  "ContrCap",
  "Macro Oracle",
  "BullBot",
  "ElectionBrain",
];

const SUPPORTING_AGENTS = [
  "Neural Scout",
  "Macro Oracle",
  "QuantHawk",
  "PolicyPulse",
  "BullBot",
];

const AGENT_SLUGS: Record<string, string> = {
  DoomBot: "doombot",
  ContrCap: "contr-cap",
  "Macro Oracle": "macro-oracle",
  BullBot: "bullbot",
  ElectionBrain: "election-brain",
  "Neural Scout": "neural-scout",
  QuantHawk: "quant-hawk",
  PolicyPulse: "policy-pulse",
};

const NARRATIVE_CLUSTERS = [
  { id: "macro", label: "Rates & macro", match: /fed|recession|rates|macro|rent/i, tone: "sky" as const },
  { id: "ai", label: "AI acceleration", match: /ai|nvda|breakthrough|gpt/i, tone: "violet" as const },
  { id: "crypto", label: "Crypto breakout", match: /btc|crypto|eth/i, tone: "amber" as const },
  { id: "politics", label: "Election volatility", match: /election|incumbent|debate|politic/i, tone: "rose" as const },
  { id: "sports", label: "Sports upset cycle", match: /nfl|nba|cup|champion|sport/i, tone: "emerald" as const },
];

function inferCluster(title: string): string {
  for (const c of NARRATIVE_CLUSTERS) {
    if (c.match.test(title)) return c.label;
  }
  return "Cross-market conviction";
}

function inferNarrativeState(p: ActivePosition, h: number, move: number): NarrativeStateKey {
  if (p.status === "contested" && Math.abs(move) >= 4) return "panic repricing";
  if (p.status === "contested") return "fragmenting";
  if (p.status === "moving up" && move > 2) return "consensus building";
  if (p.status === "moving up") return "contrarian breakout";
  if (Math.abs(move) < 1) return "quiet accumulation";
  return (["deadlocked", "volatility spike", "institutional split"] as const)[h % 3];
}

function consensusForSide(side: "YES" | "NO", prob: number): number {
  return side === "YES" ? Math.round(prob) : Math.round(100 - prob);
}

function buildChips(p: ActivePosition, h: number, agreement: number, pressure: number): PositionChip[] {
  const chips: PositionChip[] = [];
  const move = syntheticMove(p.market_title);
  if (agreement < 35) chips.push("ISOLATED");
  if (agreement >= 35 && agreement < 50) chips.push("CONTRARIAN");
  if (p.status === "contested") chips.push("UNDER PRESSURE");
  if (p.status === "moving up") chips.push("CONSENSUS BUILDING");
  if (inferNarrativeState(p, h, move) === "fragmenting") chips.push("FRAGMENTING");
  if (pressure >= 70) chips.push("UNDER PRESSURE");
  if (p.amount >= 500) chips.push("HIGH CONVICTION");
  if (h % 5 === 0 && p.status !== "contested") chips.push("EARLY");
  if (pressure >= 55 && agreement > 60) chips.push("RECEIPT FORMING");
  const unique = [...new Set(chips)];
  return unique.slice(0, 2);
}

function buildLifecycle(p: ActivePosition, h: number, contested: boolean): LifecycleEvent[] {
  const stages: LifecycleStage[] = ["OPENED"];
  if (p.amount >= 400 || h % 3 === 0) stages.push("DOUBLED DOWN");
  if (Math.abs(syntheticMove(p.market_title)) >= 3) stages.push("CONSENSUS SHIFT");
  if (contested) stages.push("BATTLE ESCALATION");

  const details: Record<LifecycleStage, string> = {
    OPENED: `Public ${p.side} thesis entered at network ${consensusForSide(p.side, p.current_probability)}% alignment.`,
    "DOUBLED DOWN": "Conviction reinforced — exposure increased on record.",
    "CONSENSUS SHIFT": `Consensus repriced ${syntheticMove(p.market_title) > 0 ? "+" : ""}${syntheticMove(p.market_title)}pt since entry.`,
    "BATTLE ESCALATION": `${OPPOSING_AGENTS[h % OPPOSING_AGENTS.length]} escalated — battle spread widening.`,
    VERIFIED: "Receipt verified — reputation compounding.",
    FAILED: "Thesis invalidated — calibration standing at risk.",
    AFTERMATH: "Network realigned — narrative cluster repriced.",
  };

  return stages.map((stage, i) => ({
    stage,
    label: stage.replace(/_/g, " "),
    detail: details[stage],
    at: p.created_at,
    active: i === stages.length - 1,
  }));
}

function buildRightIfRight(p: ActivePosition, h: number, cluster: string): RightIfRight {
  const repGain = 8 + (h % 14);
  const verifyProb = 42 + (h % 38);
  const opposing = OPPOSING_AGENTS[h % OPPOSING_AGENTS.length];
  const exposed = OPPOSING_AGENTS.filter((_, i) => i !== h % OPPOSING_AGENTS.length).slice(0, 3);

  return {
    reputation_gain: repGain,
    verification_probability: verifyProb,
    network_shift: `${cluster} shifts toward your cluster`,
    invalidated_agents: [opposing, exposed[0] ?? "ContrCap"].filter(Boolean),
    narratives_collapse: [`${cluster} fragmentation`, "Opposing desk thesis"],
    exposed_agents: exposed,
    summary_lines: [
      `+${repGain} reputation`,
      `${cluster} shifts toward your cluster`,
      `${2 + (h % 2)} opposing agents lose calibration standing`,
    ],
  };
}

export function enrichActive(p: ActivePosition): EnrichedActivePosition {
  const h = hash(p.id, p.market_title);
  const move = syntheticMove(p.market_title);
  const entry_probability = Math.round(
    Math.max(5, Math.min(95, p.current_probability + ((h % 21) - 10))),
  );
  const movement_since_entry = Math.round(p.current_probability - entry_probability);
  const heldMs = Date.now() - new Date(p.created_at).getTime();
  const days = Math.floor(heldMs / 86400000);
  const time_held_label =
    days < 1 ? "Opened today" : days === 1 ? "1 day held" : `${days} days held`;

  const contested = p.status === "contested";
  const network_agreement = 32 + (h % 48);
  const consensus_current = consensusForSide(p.side, p.current_probability);
  const consensus_drift = movement_since_entry * (p.side === "YES" ? 1 : -1);
  const pressure_score = contested ? 68 + (h % 22) : 28 + (h % 45);
  const narrative_cluster = inferCluster(p.market_title);
  const narrative_state = inferNarrativeState(p, h, move);
  const rep_exposure = Math.round(p.amount / 12 + pressure_score * 0.35);
  const verification_odds = 35 + (h % 50) + (contested ? -8 : 6);
  const timing_edge = Math.max(0, Math.min(99, 40 + (h % 40) - (contested ? 10 : 0)));
  const conviction_strength = Math.min(100, Math.round((p.amount / 10) + (h % 25)));

  const network_direction: "toward" | "away" | "stable" =
    p.status === "moving up" ? "toward" : contested && network_agreement < 40 ? "away" : "stable";

  const opposing_idx = h % OPPOSING_AGENTS.length;
  const supporting = [
    SUPPORTING_AGENTS[(h + 1) % SUPPORTING_AGENTS.length],
    SUPPORTING_AGENTS[(h + 3) % SUPPORTING_AGENTS.length],
  ];

  let why_it_matters = `Your public ${p.side} conviction is on the record while the network reprices this market.`;
  if (contested) {
    why_it_matters =
      "Agents split sharply — your position is a reputation signal in a live disagreement.";
  } else if (p.status === "moving up") {
    why_it_matters = "Thesis gaining traction — your call aligns with recent conviction drift.";
  }

  const isolation_line =
    network_agreement < 40
      ? `Your ${p.side} thesis became isolated after ${82 + (h % 12)}% of high-rep agents flipped ${p.side === "YES" ? "NO" : "YES"}.`
      : undefined;

  const rh: ResolutionHorizon | null =
    p.resolution_horizon ??
    resolutionHorizon({
      expected_resolution_at: p.expected_resolution_at,
      resolved_at: p.resolved_at,
      resolved_outcome: p.resolved_outcome,
    });

  return {
    ...p,
    slug: p.market_slug ?? titleToSlug(p.market_title),
    resolution_horizon: rh,
    entry_probability,
    movement_since_entry,
    time_held_label,
    network_agreement,
    opposing_agent: OPPOSING_AGENTS[opposing_idx],
    why_it_matters,
    contested,
    narrative_cluster,
    narrative_state,
    pressure_score,
    conviction_strength,
    consensus_current,
    consensus_drift,
    rep_exposure,
    verification_odds,
    timing_edge,
    chips: buildChips(p, h, network_agreement, pressure_score),
    supporting_agents: supporting,
    opposing_agents: [OPPOSING_AGENTS[opposing_idx], OPPOSING_AGENTS[(opposing_idx + 2) % OPPOSING_AGENTS.length]],
    network_direction,
    lifecycle: buildLifecycle(p, h, contested),
    right_if_right: buildRightIfRight(p, h, narrative_cluster),
    isolation_line,
  };
}

export function groupActivePositionsByHorizon(
  positions: EnrichedActivePosition[],
): { key: PositionHorizonGroupKey; title: string; positions: EnrichedActivePosition[] }[] {
  const buckets = new Map<PositionHorizonGroupKey, EnrichedActivePosition[]>();
  for (const group of POSITION_HORIZON_GROUPS) {
    buckets.set(group.key, []);
  }
  for (const position of positions) {
    const key = positionHorizonGroup(position.resolution_horizon);
    buckets.get(key)?.push(position);
  }
  return POSITION_HORIZON_GROUPS.map((group) => ({
    key: group.key,
    title: group.title,
    positions: buckets.get(group.key) ?? [],
  })).filter((group) => group.positions.length > 0);
}

export function enrichResolved(p: ResolvedPosition): EnrichedResolvedPosition {
  const h = hash(p.id, p.market_title);
  const correct = p.result === "correct";
  const reputation_delta = correct ? 4 + (h % 12) : -(2 + (h % 8));
  const days_early = 1 + (h % 14);
  const narrative_cluster = inferCluster(p.market_title);
  const was_early = days_early >= 5;
  const timing_quality: EnrichedResolvedPosition["timing_quality"] =
    days_early >= 8 ? "excellent" : days_early >= 4 ? "good" : "late";

  return {
    ...p,
    slug: titleToSlug(p.market_title),
    reputation_delta,
    days_early,
    outcome_label: correct ? "Receipt verified" : "Thesis invalidated",
    narrative_cluster,
    timing_quality,
    was_early,
    consensus_at_entry: p.probability_at_entry,
    verification_outcome: correct ? "Verified on public record" : "Failed verification",
    linked_battle: h % 3 === 0 ? `Battle W${10 + (h % 20)}` : undefined,
    linked_season: `Season ${2025 + (h % 2)}`,
    archival_note: correct
      ? `${was_early ? "Early" : "On-time"} ${p.side} call — ${narrative_cluster} receipt archived.`
      : `Timing ${timing_quality} — consensus had shifted before resolution.`,
  };
}

export function buildCommandCenter(
  stats: Stats,
  active: EnrichedActivePosition[],
  resolved: EnrichedResolvedPosition[],
  pulse: number,
): ConvictionCommandCenter {
  const net_exposure = active.reduce((s, p) => s + p.amount, 0);
  const reputation_at_risk = active.reduce((s, p) => s + p.rep_exposure, 0);
  const narratives = new Set(active.map((p) => p.narrative_cluster)).size;
  const under_pressure = active.filter((p) => p.pressure_score >= 60).length;
  const near_verify = active.filter((p) => p.verification_odds >= 65).length;
  const avg_align =
    active.length > 0
      ? Math.round(active.reduce((s, p) => s + p.network_agreement, 0) / active.length)
      : 0;
  const isolated = active.filter((p) => p.network_agreement < 40).length;
  const aligned_macro = active.filter(
    (p) => /macro|rates|fed/i.test(p.market_title) && p.network_agreement >= 55,
  ).length;

  const pressure_avg =
    active.length > 0
      ? Math.round(active.reduce((s, p) => s + p.pressure_score, 0) / active.length)
      : 0;
  const topAmount = active.length ? Math.max(...active.map((p) => p.amount)) : 0;
  const concentration =
    active.length && net_exposure > 0
      ? Math.round((topAmount / net_exposure) * 100)
      : 0;
  const timing_avg =
    active.length > 0
      ? Math.round(active.reduce((s, p) => s + p.timing_edge, 0) / active.length)
      : 0;
  const narrative_concentration = narratives;
  const divergence =
    active.length > 0
      ? Math.round(
          active.reduce((s, p) => s + Math.abs(50 - p.network_agreement), 0) / active.length,
        )
      : 0;

  const intelligence: ConvictionCommandCenter["intelligence"] = [];
  if (isolated > 0) {
    intelligence.push({
      id: "iso",
      text: `${isolated} position${isolated > 1 ? "s" : ""} isolated against rising consensus`,
      tone: "amber",
    });
  }
  if (aligned_macro > 0) {
    intelligence.push({
      id: "macro",
      text: "Macro exposure aligned with high-rep desks",
      tone: "teal",
    });
  }
  const aiPressure = active.find((p) => /ai|nvda/i.test(p.market_title) && p.pressure_score >= 55);
  if (aiPressure) {
    intelligence.push({
      id: "ai",
      text: "AI acceleration thesis under pressure",
      tone: "rose",
    });
  }
  if (near_verify > 0) {
    intelligence.push({
      id: "verify",
      text: `${near_verify} position${near_verify > 1 ? "s" : ""} nearing verification`,
      tone: "violet",
    });
  }
  if (intelligence.length === 0) {
    intelligence.push({
      id: "calm",
      text: "Conviction ledger stable — network pulse calm",
      tone: "teal",
    });
  }

  return {
    net_exposure,
    reputation_at_risk,
    active_narratives: narratives,
    markets_under_pressure: under_pressure,
    verification_proximity: near_verify,
    consensus_alignment: avg_align,
    metrics: [
      {
        id: "pressure",
        label: "Pressure score",
        value: String(pressure_avg || "—"),
        sub: "network stress on open calls",
        tone: "rose",
      },
      {
        id: "concentration",
        label: "Conviction concentration",
        value: concentration ? `${concentration}%` : "—",
        sub: "largest single exposure",
        tone: "violet",
      },
      {
        id: "timing",
        label: "Timing quality",
        value: timing_avg ? `${timing_avg}` : "—",
        sub: "edge vs consensus entry",
        tone: "teal",
      },
      {
        id: "narrative",
        label: "Narrative concentration",
        value: String(narrative_concentration || "—"),
        sub: "active thesis clusters",
        tone: "amber",
      },
      {
        id: "divergence",
        label: "Consensus divergence",
        value: divergence ? `${divergence}pt` : "—",
        sub: "avg isolation from crowd",
        tone: "sky",
      },
    ],
    intelligence,
  };
}

export function buildConvictionSignals(active: EnrichedActivePosition[]): ConvictionSignal[] {
  if (active.length === 0) return [];

  const pick = (
    kind: ConvictionSignal["kind"],
    label: string,
    selector: (a: EnrichedActivePosition, b: EnrichedActivePosition) => number,
    valueFn: (p: EnrichedActivePosition) => string,
    subFn: (p: EnrichedActivePosition) => string,
  ): ConvictionSignal | null => {
    const sorted = [...active].sort(selector);
    const p = sorted[0];
    if (!p) return null;
    return {
      id: kind,
      kind,
      label,
      position_id: p.id,
      slug: p.slug,
      market_title: p.market_title,
      side: p.side,
      narrative_state: p.narrative_state,
      rep_exposure: p.rep_exposure,
      network_direction: p.network_direction,
      signal_value: valueFn(p),
      signal_sub: subFn(p),
    };
  };

  const signals = [
    pick(
      "strongest",
      "Strongest conviction",
      (a, b) => b.amount - a.amount,
      (p) => `€${p.amount}`,
      (p) => `${p.conviction_strength}% strength`,
    ),
    pick(
      "contrarian",
      "Most contrarian",
      (a, b) => a.network_agreement - b.network_agreement,
      (p) => `${p.network_agreement}% align`,
      (p) => p.chips[0] ?? "ISOLATED",
    ),
    pick(
      "verification",
      "Closest to verification",
      (a, b) => b.verification_odds - a.verification_odds,
      (p) => `${p.verification_odds}% odds`,
      (p) => "Receipt forming",
    ),
    pick(
      "pressure",
      "Highest pressure",
      (a, b) => b.pressure_score - a.pressure_score,
      (p) => `${p.pressure_score}`,
      (p) => p.narrative_state.replace(/_/g, " "),
    ),
    pick(
      "disagreement",
      "Biggest disagreement",
      (a, b) => (b.contested ? 1 : 0) - (a.contested ? 1 : 0) || b.pressure_score - a.pressure_score,
      (p) => p.opposing_agent,
      (p) => `${p.opposing_agents.length} opposing voices`,
    ),
    pick(
      "moving",
      "Fastest moving thesis",
      (a, b) => Math.abs(b.movement_since_entry) - Math.abs(a.movement_since_entry),
      (p) => `${p.movement_since_entry > 0 ? "+" : ""}${p.movement_since_entry}pt`,
      (p) => p.consensus_drift !== 0 ? "Consensus drift" : "Repricing",
    ),
  ].filter((s): s is ConvictionSignal => s !== null);

  return signals;
}

export function buildNarrativeExposure(
  active: EnrichedActivePosition[],
  resolved: EnrichedResolvedPosition[],
): { rows: NarrativeExposureRow[]; identity_line: string } {
  const all = [...active, ...resolved];
  if (all.length === 0) {
    return { rows: [], identity_line: "No narrative exposure on record yet." };
  }

  const totals = new Map<string, { count: number; align: number; volatile: number }>();
  for (const p of all) {
    const cluster = p.narrative_cluster;
    const cur = totals.get(cluster) ?? { count: 0, align: 0, volatile: 0 };
    cur.count += 1;
    if ("network_agreement" in p && p.network_agreement >= 55) cur.align += 1;
    if ("network_agreement" in p && p.network_agreement < 45) cur.volatile += 1;
    if ("pressure_score" in p && p.pressure_score >= 60) cur.volatile += 1;
    totals.set(cluster, cur);
  }

  const totalCount = all.length;
  const rows: NarrativeExposureRow[] = NARRATIVE_CLUSTERS.map((c) => {
    const data = [...totals.entries()].find(([k]) => k === c.label);
    const count = data?.[1].count ?? 0;
    const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
    const d = data?.[1];
    const alignment: NarrativeExposureRow["alignment"] =
      !d || d.align === d.count ? "aligned" : d.volatile >= d.align ? "isolated" : "mixed";
    const volatility: NarrativeExposureRow["volatility"] =
      d && d.volatile >= Math.ceil(d.count / 2) ? "volatile" : "stable";
    return {
      cluster: c.label,
      exposure_pct: pct,
      alignment,
      volatility,
      tone: c.tone,
    };
  }).filter((r) => r.exposure_pct > 0);

  const top = [...rows].sort((a, b) => b.exposure_pct - a.exposure_pct).slice(0, 2);
  const overweight = top.map((t) => t.cluster.toLowerCase()).join(" and ");
  const fragmented = rows.some((r) => r.volatility === "volatile" && r.alignment === "isolated");
  const identity_line = fragmented
    ? `Your identity is overweight ${overweight} and recession fragmentation.`
    : `Your identity is overweight ${overweight}.`;

  return { rows, identity_line };
}

export function buildPressureFeed(active: EnrichedActivePosition[]): PressureFeedItem[] {
  const items: PressureFeedItem[] = [];
  const now = new Date().toISOString();

  for (const p of active) {
    const h = hash(p.id, p.market_title);
    if (p.contested) {
      items.push({
        id: `${p.id}-opp`,
        position_id: p.id,
        slug: p.slug,
        text: `${p.opposing_agent} moved against your thesis`,
        tone: "rose",
        at: now,
      });
    }
    if (Math.abs(p.consensus_drift) >= 3) {
      items.push({
        id: `${p.id}-repr`,
        position_id: p.id,
        slug: p.slug,
        text: `Consensus repriced ${p.consensus_drift > 0 ? "+" : ""}${p.consensus_drift}pt on ${p.market_title}`,
        tone: "amber",
        at: now,
      });
    }
    if (p.contested) {
      items.push({
        id: `${p.id}-battle`,
        position_id: p.id,
        slug: p.slug,
        text: "Battle spread widening",
        tone: "violet",
        at: now,
      });
    }
    if (p.verification_odds >= 65) {
      items.push({
        id: `${p.id}-receipt`,
        position_id: p.id,
        slug: p.slug,
        text: "Receipt forming",
        tone: "emerald",
        at: now,
      });
    }
    if (h % 4 === 0) {
      items.push({
        id: `${p.id}-resurface`,
        position_id: p.id,
        slug: p.slug,
        text: "Your call resurfaced in network tape",
        tone: "sky",
        at: now,
      });
    }
    if (p.network_direction === "toward") {
      items.push({
        id: `${p.id}-cluster`,
        position_id: p.id,
        slug: p.slug,
        text: "High-rep cluster aligning with your position",
        tone: "emerald",
        at: now,
      });
    }
  }

  return items.slice(0, 8);
}

export function buildNetworkLayer(active: EnrichedActivePosition[]): NetworkAgent[] {
  const agents: NetworkAgent[] = [];
  const seen = new Set<string>();

  for (const p of active) {
    for (const name of p.supporting_agents) {
      if (seen.has(name)) continue;
      seen.add(name);
      agents.push({
        name,
        slug: AGENT_SLUGS[name] ?? name.toLowerCase().replace(/\s/g, "-"),
        relation: "aligned",
        detail: `Aligned on ${p.market_title}`,
      });
    }
    for (const name of p.opposing_agents) {
      if (seen.has(name)) continue;
      seen.add(name);
      agents.push({
        name,
        slug: AGENT_SLUGS[name] ?? name.toLowerCase().replace(/\s/g, "-"),
        relation: "opposing",
        detail: `Opposing ${p.side} on ${p.market_title}`,
      });
    }
  }

  if (active.length >= 2) {
    agents.push({
      name: "Desk cluster α",
      slug: "desk-cluster",
      relation: "cluster",
      detail: `Similar conviction on ${active[0].narrative_cluster}`,
    });
    agents.push({
      name: "12 followers",
      slug: "followers",
      relation: "follower",
      detail: "Exposed to same narrative threads",
    });
  }

  return agents.slice(0, 8);
}

export function buildIdentityInsights(
  active: EnrichedActivePosition[],
  resolved: EnrichedResolvedPosition[],
): IdentityInsight[] {
  const all = [...active, ...resolved];
  if (all.length === 0) return [];

  const macroCount = all.filter((p) => /fed|recession|rates|macro|rent/i.test(p.market_title)).length;
  const volatileCount = all.filter((p) => /btc|crypto|nvda|ai|breakthrough/i.test(p.market_title)).length;
  const contested = active.filter((p) => p.contested);
  const isolated = active.filter((p) => p.network_agreement < 40);
  const highestConviction = [...active].sort((a, b) => b.amount - a.amount)[0];

  const insights: IdentityInsight[] = [];

  if (isolated.length > 0) {
    insights.push({
      id: "isolated",
      label: "Isolation risk",
      value: `${isolated.length} thesis${isolated.length > 1 ? "es" : ""} running against consensus`,
      tone: "amber",
    });
  }
  if (macroCount >= 2) {
    insights.push({
      id: "macro",
      label: "Macro exposure",
      value: "Contrarian on rates & macro cluster",
      tone: "sky",
    });
  }
  if (volatileCount >= 2) {
    insights.push({
      id: "vol",
      label: "Volatility profile",
      value: "High-volatility narrative overweight",
      tone: "amber",
    });
  }
  if (highestConviction) {
    insights.push({
      id: "conviction",
      label: "Strongest signal",
      value: highestConviction.market_title,
      tone: "violet",
    });
  }
  if (contested[0]) {
    insights.push({
      id: "contested",
      label: "Under fire",
      value: contested[0].market_title,
      tone: "rose",
    });
  }

  return insights.slice(0, 4);
}

export function enrichTimelineEntries(payload: PositionsPayload) {
  const extra: typeof payload.timeline = [];

  payload.active_positions.forEach((p) => {
    const move = syntheticMove(p.market_title);
    if (Math.abs(move) >= 3) {
      extra.push({
        id: p.id * 1000 + 1,
        kind: "consensus shift",
        market_title: p.market_title,
        side: p.side,
        amount: p.amount,
        created_at: p.created_at,
        note: `Consensus repriced ${move > 0 ? "+" : ""}${move}pt — ${p.status === "contested" ? "battle pressure building" : "network drift"}.`,
      });
    }
    if (p.status === "contested") {
      extra.push({
        id: p.id * 1000 + 2,
        kind: "battle escalation",
        market_title: p.market_title,
        side: p.side,
        amount: p.amount,
        created_at: p.created_at,
        note: `${OPPOSING_AGENTS[hash(p.id, p.market_title) % OPPOSING_AGENTS.length]} escalated — reputation exposure rising.`,
        status: "contested",
      });
    }
  });

  payload.resolved_positions.forEach((p) => {
    if (p.result === "correct") {
      extra.push({
        id: p.id * 1000 + 3,
        kind: "receipt verified",
        market_title: p.market_title,
        side: p.side,
        amount: p.amount,
        created_at: p.resolved_at,
        note: "Receipt verified — reputation compounding on your public record.",
        result: "correct",
      });
      extra.push({
        id: p.id * 1000 + 4,
        kind: "aftermath",
        market_title: p.market_title,
        side: p.side,
        amount: p.amount,
        created_at: p.resolved_at,
        note: "Network realigned — conviction archive updated.",
        result: "correct",
      });
    }
  });

  return [...payload.timeline, ...extra].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

/** @deprecated use buildCommandCenter */
export function buildHeroStats(
  stats: Stats,
  active: EnrichedActivePosition[],
  resolved: EnrichedResolvedPosition[],
  pulse: number,
) {
  const cc = buildCommandCenter(stats, active, resolved, pulse);
  return [
    { label: "Net exposure", value: `€${cc.net_exposure}`, sub: "open conviction" },
    { label: "Rep at risk", value: String(cc.reputation_at_risk), sub: "standing exposed" },
    { label: "Active narratives", value: String(cc.active_narratives), sub: "thesis clusters" },
    { label: "Under pressure", value: String(cc.markets_under_pressure), sub: "markets stressed" },
    { label: "Near verification", value: String(cc.verification_proximity), sub: "receipt proximity" },
    { label: "Consensus align", value: `${cc.consensus_alignment}%`, sub: "vs isolation" },
  ];
}
