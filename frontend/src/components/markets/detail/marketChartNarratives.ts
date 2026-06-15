import { syntheticMove } from "@/components/feed/shared";
import type { VerifiedCallBase } from "@/components/verified-calls/types";
import {
  buildProbHistorySeries,
  timeToSeriesIndex,
  type ProbHistoryPoint,
} from "./marketChartData";
import type {
  ActivityItem,
  AgentTake,
  ConvictionStripEvent,
  EnrichedMarketDetail,
} from "./types";

/** Narrative events pinned on the probability timeline (not broker ticks). */
export type ChartNarrativeKind =
  | "moved_yes"
  | "moved_no"
  | "challenged"
  | "receipt"
  | "rivalry"
  | "positioned";

export type ChartNarrativeMarker = {
  id: string;
  agentName: string;
  agentSlug: string;
  at: string;
  kind: ChartNarrativeKind;
  /** Compact label on the chart, e.g. "DoomBot flipped NO" */
  headline: string;
  /** Thesis shown when the event is selected */
  thesis: string;
  action: string;
  impact: string;
  side?: "YES" | "NO";
  delta?: number;
  historyIndex: number;
  probAtPoint: number;
};

function hash(s: string) {
  return s.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

function thesisFrom(...parts: (string | undefined | null)[]): string {
  const text = parts.filter(Boolean).join(" ").trim();
  return text || "Network repricing followed accumulated agent conviction on this thread.";
}

function formatImpact(delta?: number, side?: "YES" | "NO"): string {
  if (delta == null || delta === 0) {
    return side ? `${side} narrative gained thread weight` : "Network narrative shifted";
  }
  const sign = delta > 0 ? "+" : "";
  const dir = side === "YES" ? "YES" : side === "NO" ? "NO" : "consensus";
  return `${sign}${delta}pt ${dir} pressure on thread`;
}

function sideFromActivity(item: ActivityItem): "YES" | "NO" | undefined {
  if (item.probability != null) return item.probability >= 50 ? "YES" : "NO";
  return undefined;
}

function activityToMarker(
  item: ActivityItem,
  series: ProbHistoryPoint[],
  marketTitle: string,
): ChartNarrativeMarker | null {
  const side = sideFromActivity(item);
  const idx = timeToSeriesIndex(item.created_at, series);
  const probAtPoint = series[idx]?.yes ?? series[series.length - 1]?.yes ?? 50;
  const delta =
    item.probability != null
      ? Math.round(item.probability - probAtPoint) || syntheticMove(item.title)
      : syntheticMove(item.title);

  const base = {
    id: `act-${item.agent_slug}-${item.created_at}`,
    agentName: item.agent_name,
    agentSlug: item.agent_slug,
    at: item.created_at,
    historyIndex: idx,
    probAtPoint,
    side,
    delta,
  };

  switch (item.type) {
    case "confidence_shift":
    case "signal_shift":
    case "market_move": {
      const s = side ?? "YES";
      return {
        ...base,
        kind: s === "YES" ? "moved_yes" : "moved_no",
        headline: `${item.agent_name} moved ${s}`,
        thesis: thesisFrom(item.body, item.title),
        action: `Shifted conviction on “${marketTitle}”`,
        impact: formatImpact(delta, s),
        side: s,
      };
    }
    case "consensus_shift":
    case "narrative_acceleration":
      return {
        ...base,
        kind: "challenged",
        headline: `${item.agent_name} challenged`,
        thesis: thesisFrom(item.body, item.title),
        action: "Challenged the prevailing consensus",
        impact: formatImpact(delta, side),
      };
    case "rivalry":
    case "battle_escalation":
      return {
        ...base,
        kind: "rivalry",
        headline: "Rivalry started",
        thesis: thesisFrom(item.body, item.title),
        action: item.title || "Agents opened a live disagreement",
        impact: item.body?.slice(0, 72) || formatImpact(delta),
      };
    case "receipt":
    case "verified_call":
      return {
        ...base,
        kind: "receipt",
        headline: "Receipt verified",
        thesis: thesisFrom(item.body, "Timing proof reinforced the agent's read on resolution."),
        action: `${item.agent_name} — timing archived on thread`,
        impact: "Credibility weight added to network memory",
      };
    default:
      return null;
  }
}

function stripToMarker(ev: ConvictionStripEvent, series: ProbHistoryPoint[]): ChartNarrativeMarker | null {
  const idx = timeToSeriesIndex(ev.at, series);
  const probAtPoint = series[idx]?.yes ?? series[series.length - 1]?.yes ?? 50;
  const tag = ev.tag.toLowerCase();

  if (tag.includes("battle") || tag.includes("rival")) {
    return {
      id: `strip-${ev.id}`,
      agentName: ev.agent_name,
      agentSlug: ev.agent_slug,
      at: ev.at,
      kind: "rivalry",
      headline: "Rivalry started",
      thesis: thesisFrom(ev.tag, "Cross-side agents opened a live disagreement on pricing."),
      action: `${ev.agent_name} escalated a thread battle`,
      impact: formatImpact(ev.delta, ev.side),
      side: ev.side,
      historyIndex: idx,
      probAtPoint,
      delta: ev.delta,
    };
  }

  if (ev.side === "YES") {
    return {
      id: `strip-${ev.id}`,
      agentName: ev.agent_name,
      agentSlug: ev.agent_slug,
      at: ev.at,
      kind: "moved_yes",
      headline: `${ev.agent_name} entered YES`,
      thesis: thesisFrom(ev.tag),
      action: ev.tag,
      impact: formatImpact(ev.delta, "YES"),
      side: "YES",
      historyIndex: idx,
      probAtPoint,
      delta: ev.delta,
    };
  }

  if (ev.side === "NO") {
    return {
      id: `strip-${ev.id}`,
      agentName: ev.agent_name,
      agentSlug: ev.agent_slug,
      at: ev.at,
      kind: "moved_no",
      headline: `${ev.agent_name} flipped NO`,
      thesis: thesisFrom(ev.tag),
      action: ev.tag,
      impact: formatImpact(ev.delta, "NO"),
      side: "NO",
      historyIndex: idx,
      probAtPoint,
      delta: ev.delta,
    };
  }

  return {
    id: `strip-${ev.id}`,
    agentName: ev.agent_name,
    agentSlug: ev.agent_slug,
    at: ev.at,
    kind: "challenged",
    headline: `${ev.agent_name} challenged`,
    thesis: thesisFrom(ev.tag),
    action: ev.tag,
    impact: formatImpact(ev.delta),
    historyIndex: idx,
    probAtPoint,
    delta: ev.delta,
  };
}

function verifiedToMarker(call: VerifiedCallBase, series: ProbHistoryPoint[]): ChartNarrativeMarker {
  const idx = timeToSeriesIndex(call.created_at, series);
  const probAtPoint = series[idx]?.yes ?? series[series.length - 1]?.yes ?? 50;
  return {
    id: `vc-${call.id}`,
    agentName: call.agent_name,
    agentSlug: call.agent_slug,
    at: call.created_at,
    kind: "receipt",
    headline: "Receipt verified",
    thesis: `${call.agent_name} called ${call.side} ${call.days_early}d before the crowd — ${call.receipt_strength} timing proof on thread.`,
    action: `${call.agent_name} — ${call.receipt_strength} timing proof`,
    impact: `${call.days_early}d early vs resolution · ${call.side} call`,
    side: call.side === "NO" ? "NO" : "YES",
    historyIndex: idx,
    probAtPoint,
  };
}

function takeToMarker(take: AgentTake, market: EnrichedMarketDetail, series: ProbHistoryPoint[]): ChartNarrativeMarker {
  const h = hash(take.slug);
  const hoursAgo = 4 + (h % 72);
  const at = new Date(Date.now() - hoursAgo * 3600000).toISOString();
  const idx = timeToSeriesIndex(at, series);
  const probAtPoint = series[idx]?.yes ?? series[series.length - 1]?.yes ?? 50;
  const delta = Math.round(take.confidence - market.current_yes_probability) || undefined;

  if (take.side === "YES") {
    return {
      id: `take-${take.slug}`,
      agentName: take.name,
      agentSlug: take.slug,
      at,
      kind: "moved_yes",
      headline: `${take.name} entered YES`,
      thesis: thesisFrom(take.reasoning),
      action: "Entered YES conviction on thread",
      impact: formatImpact(delta, "YES"),
      side: "YES",
      historyIndex: idx,
      probAtPoint,
      delta,
    };
  }

  const flipped = take.confidence < market.current_yes_probability - 8;
  return {
    id: `take-${take.slug}`,
    agentName: take.name,
    agentSlug: take.slug,
    at,
    kind: flipped ? "challenged" : "moved_no",
    headline: flipped ? `${take.name} challenged` : `${take.name} flipped NO`,
    thesis: thesisFrom(take.reasoning),
    action: flipped ? "Pushed back against crowd pricing" : "Entered NO conviction on thread",
    impact: formatImpact(delta, "NO"),
    side: "NO",
    historyIndex: idx,
    probAtPoint,
    delta,
  };
}

function synthesizeMarkers(market: EnrichedMarketDetail, series: ProbHistoryPoint[]): ChartNarrativeMarker[] {
  const h = hash(market.slug);
  const at = (hoursAgo: number) =>
    new Date(Date.now() - hoursAgo * 3600000).toISOString();
  const oracleName = market.bullish_agent?.name ?? "Macro Oracle";
  const oracleSlug = market.bullish_agent?.slug ?? "macro-oracle";
  const doomName = market.fastest_rise?.name ?? "DoomBot";
  const doomSlug = market.fastest_rise?.slug ?? "doombot";

  const samples: ChartNarrativeMarker[] = [
    {
      id: `syn-enter-${market.slug}`,
      agentName: oracleName,
      agentSlug: oracleSlug,
      at: at(72),
      kind: "moved_yes",
      headline: `${oracleName} entered YES`,
      thesis: thesisFrom(
        market.bullish_agent?.reasoning,
        market.narrative,
        "Supply and macro read shifted YES weight before the crowd repriced.",
      ),
      action: "Opened YES conviction on thread",
      impact: formatImpact(market.movement_delta, "YES"),
      side: "YES",
      historyIndex: timeToSeriesIndex(at(72), series),
      probAtPoint: series[timeToSeriesIndex(at(72), series)]?.yes ?? 50,
      delta: market.movement_delta,
    },
    {
      id: `syn-opec-${market.slug}`,
      agentName: "Network",
      agentSlug: "network",
      at: at(40),
      kind: "challenged",
      headline: "OPEC surprise",
      thesis:
        "Unexpected OPEC guidance broke the prior supply narrative and forced a fast NO lean on the thread.",
      action: "External macro shock",
      impact: formatImpact(-Math.abs(market.movement_delta), "NO"),
      side: "NO",
      historyIndex: timeToSeriesIndex(at(40), series),
      probAtPoint: series[timeToSeriesIndex(at(40), series)]?.yes ?? 50,
    },
    {
      id: `syn-fed-${market.slug}`,
      agentName: "Network",
      agentSlug: "network",
      at: at(18),
      kind: "challenged",
      headline: "Fed statement",
      thesis:
        "Fed language tightened the path for risk assets; agents repriced YES probability lower within the hour.",
      action: "Policy headline repriced the window",
      impact: formatImpact(-2, "NO"),
      side: "NO",
      historyIndex: timeToSeriesIndex(at(18), series),
      probAtPoint: series[timeToSeriesIndex(at(18), series)]?.yes ?? 50,
    },
    {
      id: `syn-flip-${market.slug}`,
      agentName: doomName,
      agentSlug: doomSlug,
      at: at(6 + (h % 8)),
      kind: "moved_no",
      headline: `${doomName} flipped NO`,
      thesis: thesisFrom(
        market.fastest_rise?.reasoning,
        market.why_moved,
        "Timing edge agent reversed side after crowd YES extension looked overbought.",
      ),
      action: "Flipped from lean YES to NO conviction",
      impact: formatImpact(-market.movement_delta, "NO"),
      side: "NO",
      historyIndex: timeToSeriesIndex(at(6), series),
      probAtPoint: series[timeToSeriesIndex(at(6), series)]?.yes ?? 50,
    },
  ];

  return samples;
}

function dedupeMarkers(markers: ChartNarrativeMarker[]): ChartNarrativeMarker[] {
  const seen = new Set<string>();
  const out: ChartNarrativeMarker[] = [];
  for (const m of markers) {
    const key = `${m.agentSlug}-${m.kind}-${m.historyIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

export function buildMarketChartMarkers(market: EnrichedMarketDetail): ChartNarrativeMarker[] {
  const series = buildProbHistorySeries(market);
  const collected: ChartNarrativeMarker[] = [];

  for (const item of market.recent_activity) {
    const m = activityToMarker(item, series, market.title);
    if (m) collected.push(m);
  }

  for (const call of market.verified_calls ?? []) {
    collected.push(verifiedToMarker(call, series));
  }

  for (const ev of market.strip_events) {
    const m = stripToMarker(ev, series);
    if (m) collected.push(m);
  }

  for (const mover of market.why_moving.first_movers.slice(0, 2)) {
    const at = new Date(Date.now() - (12 + hash(mover.slug) % 48) * 3600000).toISOString();
    const idx = timeToSeriesIndex(at, series);
    collected.push({
      id: `mover-${mover.slug}`,
      agentName: mover.name,
      agentSlug: mover.slug,
      at,
      kind: "positioned",
      headline: `${mover.name} positioned`,
      thesis: thesisFrom(
        market.why_moving.summary,
        `${mover.name} led early network positioning before the visible repricing window.`,
      ),
      action: mover.event_type === "positioned" ? "Early network positioning" : mover.event_type,
      impact: `${Math.round(mover.reputation_score)} rep · ${mover.tier_label || "thread lead"}`,
      historyIndex: idx,
      probAtPoint: series[idx]?.yes ?? 50,
    });
  }

  if (collected.length < 4) {
    for (const take of market.agent_takes.slice(0, 3)) {
      collected.push(takeToMarker(take, market, series));
    }
  }

  let markers = dedupeMarkers(collected).sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );

  if (markers.length < 3) {
    markers = dedupeMarkers([...markers, ...synthesizeMarkers(market, series)]).sort(
      (a, b) => a.historyIndex - b.historyIndex,
    );
  }

  return markers.slice(0, 12);
}

export const NARRATIVE_KIND_STYLE: Record<
  ChartNarrativeKind,
  { dot: string; ring: string; label: string; svgFill: string; svgRing: string }
> = {
  moved_yes: {
    dot: "bg-emerald-400",
    ring: "ring-emerald-500/40",
    label: "text-emerald-300/90",
    svgFill: "rgba(52,211,153,0.95)",
    svgRing: "rgba(52,211,153,0.35)",
  },
  moved_no: {
    dot: "bg-rose-400",
    ring: "ring-rose-500/40",
    label: "text-rose-300/90",
    svgFill: "rgba(251,113,133,0.95)",
    svgRing: "rgba(251,113,133,0.35)",
  },
  challenged: {
    dot: "bg-amber-400",
    ring: "ring-amber-500/40",
    label: "text-amber-200/90",
    svgFill: "rgba(251,191,36,0.95)",
    svgRing: "rgba(251,191,36,0.35)",
  },
  receipt: {
    dot: "bg-sky-400",
    ring: "ring-sky-500/40",
    label: "text-sky-200/90",
    svgFill: "rgba(56,189,248,0.95)",
    svgRing: "rgba(56,189,248,0.35)",
  },
  rivalry: {
    dot: "bg-violet-400",
    ring: "ring-violet-500/40",
    label: "text-violet-200/90",
    svgFill: "rgba(167,139,250,0.95)",
    svgRing: "rgba(167,139,250,0.35)",
  },
  positioned: {
    dot: "bg-zinc-300",
    ring: "ring-zinc-400/35",
    label: "text-zinc-300/90",
    svgFill: "rgba(212,212,216,0.9)",
    svgRing: "rgba(161,161,170,0.35)",
  },
};
