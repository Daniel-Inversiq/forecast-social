import { agentSlugFromName, titleToSlug } from "@/lib/slugs";
import {
  computeUrgencyScore,
  enhanceAlertCopy,
  inferCta,
  inferPrioritySection,
  inferUrgencyLabel,
} from "./alertIntelligence";
import type {
  AlertDisplayType,
  AlertFilterKey,
  AlertSecondaryFilter,
  EnrichedAlert,
  RawAlert,
} from "./types";

function hash(seed: string) {
  return seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

const SECONDARY_AGENTS = ["DoomBot", "ContrCap", "BullBot", "Macro Oracle", "ChaosQuant"];

const NARRATIVES = [
  "Fed pivot cluster repricing",
  "AI capex cycle acceleration",
  "Contrarian recession timing",
  "Crypto liquidity squeeze",
  "Earnings dispersion widening",
  "Election volatility breakout",
];

const CONVICTION_CTX = [
  "High-conviction public positioning",
  "Early signal before consensus",
  "Fade-the-crowd entry",
  "Structural macro read",
  "Battle-contested split",
];

function mapDisplayType(alert: RawAlert): AlertDisplayType {
  const t = alert.type;
  const prob = alert.probability_change ?? 0;
  if (t === "public_status") return "PUBLIC STATUS";
  if (t === "position_update") return "POSITION UPDATE";
  if (t === "receipt") return "VERIFIED CALL";
  if (t === "rivalry") return "BATTLE ESCALATION";
  if (t === "leaderboard_move") return "REPUTATION MOVE";
  if (t === "consensus_shift") {
    if (/accelerat|narrative|optimism/i.test(alert.title + alert.body)) return "NARRATIVE BREAKOUT";
    return "CONSENSUS SHIFT";
  }
  if (t === "confidence_shift") {
    if (Math.abs(prob) >= 5) return "MARKET REPRICE";
    if (/contrarian|fade/i.test(alert.body)) return "CONTRARIAN ENTRY";
    return "SIGNAL ACCELERATION";
  }
  return "SIGNAL ACCELERATION";
}

function mapTone(display: AlertDisplayType): EnrichedAlert["tone"] {
  switch (display) {
    case "BATTLE ESCALATION":
      return "rose";
    case "VERIFIED CALL":
      return "emerald";
    case "REPUTATION MOVE":
      return "amber";
    case "CONSENSUS SHIFT":
    case "NARRATIVE BREAKOUT":
      return "cyan";
    case "POSITION UPDATE":
      return "sky";
    case "CONTRARIAN ENTRY":
      return "rose";
    case "PUBLIC STATUS":
      return "violet";
    default:
      return "violet";
  }
}

function buildTags(alert: RawAlert, display: AlertDisplayType): string[] {
  const tags: string[] = [];
  const age = Date.now() - new Date(alert.timestamp).getTime();
  if (age < 3600000) tags.push("live");
  if (alert.probability_change != null && Math.abs(alert.probability_change) >= 4) {
    tags.push("high_conviction");
  }
  if (display === "CONSENSUS SHIFT" || display === "NARRATIVE BREAKOUT") tags.push("consensus");
  if (display === "CONTRARIAN ENTRY" || /contrarian|fade/i.test(alert.body)) tags.push("contrarian");
  if (display === "REPUTATION MOVE" || alert.type === "leaderboard_move") tags.push("rising");
  if (display === "VERIFIED CALL") tags.push("verified");
  if (alert.unread) tags.push("unread");
  return tags;
}

export function enrichAlert(alert: RawAlert, index: number, streamed = false): EnrichedAlert {
  const h = hash(alert.timestamp + alert.type + index);
  const displayType = mapDisplayType(alert);
  const prob = alert.probability_change;
  const direction: EnrichedAlert["direction"] =
    prob == null ? "neutral" : prob > 0 ? "up" : prob < 0 ? "down" : "neutral";
  const movementSize = prob != null ? Math.abs(prob) : 2 + (h % 6);
  const age = Date.now() - new Date(alert.timestamp).getTime();
  const isLive = streamed || age < 7200000 || alert.unread;
  const marketSlug = alert.related_market ? titleToSlug(alert.related_market) : null;
  const agentSlug = alert.related_agent ? agentSlugFromName(alert.related_agent) : null;
  const prioritySection = inferPrioritySection(alert, displayType);
  const urgencyLabel = inferUrgencyLabel(alert, displayType, movementSize);
  const urgencyScore = computeUrgencyScore(alert, displayType, movementSize);
  const copy = enhanceAlertCopy(alert, displayType);
  const cta = inferCta(alert, displayType, marketSlug, agentSlug, prioritySection);

  const urgency: EnrichedAlert["urgency"] =
    urgencyLabel === "Critical"
      ? "critical"
      : urgencyLabel === "Watch" && alert.unread
        ? "high"
        : urgencyScore >= 45
          ? "high"
          : "normal";

  return {
    ...alert,
    title: copy.headline,
    body: copy.body,
    id: `${alert.type}-${alert.timestamp}-${index}${streamed ? "-live" : ""}`,
    displayType,
    marketSlug,
    agentSlug,
    reputationImpact:
      alert.type === "leaderboard_move" ? 3 + (h % 8) : displayType === "VERIFIED CALL" ? 5 + (h % 6) : null,
    confidenceDelta: prob ?? (displayType === "BATTLE ESCALATION" ? 8 + (h % 12) : null),
    movementSize,
    direction,
    narrative: pick(NARRATIVES, alert.title, h),
    tags: buildTags(alert, displayType),
    urgency,
    isLive,
    secondaryAgent:
      alert.type === "rivalry" ? pick(SECONDARY_AGENTS, alert.related_agent ?? "", h + 1) : null,
    convictionContext: pick(CONVICTION_CTX, alert.body, h + 2),
    battleRelated: alert.type === "rivalry",
    tone: mapTone(displayType),
    prioritySection,
    urgencyLabel,
    urgencyScore,
    headline: copy.headline,
    cta,
    isStreamed: streamed,
  };
}

function pick<T>(arr: T[], seed: string, offset: number): T {
  return arr[(hash(seed) + offset) % arr.length];
}

export function enrichAlerts(alerts: RawAlert[], streamedIds?: Set<string>): EnrichedAlert[] {
  return alerts.map((a, i) => {
    const id = `${a.type}-${a.timestamp}`;
    return enrichAlert(a, i, streamedIds?.has(id) ?? false);
  });
}

const FILTER_TYPES: Record<Exclude<AlertFilterKey, "all">, string[]> = {
  markets: ["confidence_shift", "consensus_shift"],
  agents: ["leaderboard_move", "confidence_shift"],
  positions: ["position_update"],
  battles: ["rivalry"],
  verified: ["receipt"],
  signals: ["confidence_shift", "consensus_shift"],
  reputation: ["leaderboard_move", "receipt"],
};

export function filterAlerts(
  alerts: EnrichedAlert[],
  filter: AlertFilterKey,
  secondary: AlertSecondaryFilter,
  query: string,
): EnrichedAlert[] {
  let list = alerts;

  if (filter !== "all") {
    const types = FILTER_TYPES[filter];
    list = list.filter((a) => types.includes(a.type));
  }

  if (secondary !== "all") {
    if (secondary === "live") list = list.filter((a) => a.isLive);
    else if (secondary === "rising") list = list.filter((a) => a.tags.includes("rising"));
    else if (secondary === "contrarian") list = list.filter((a) => a.tags.includes("contrarian"));
    else if (secondary === "high_conviction")
      list = list.filter((a) => a.tags.includes("high_conviction"));
    else if (secondary === "consensus") list = list.filter((a) => a.tags.includes("consensus"));
    else if (secondary === "verified_only") list = list.filter((a) => a.type === "receipt");
  }

  const q = query.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.body.toLowerCase().includes(q) ||
        (a.related_market?.toLowerCase().includes(q) ?? false) ||
        (a.related_agent?.toLowerCase().includes(q) ?? false),
    );
  }

  return list;
}

export function sortAlerts(alerts: EnrichedAlert[]): EnrichedAlert[] {
  const urgencyRank = { critical: 3, high: 2, normal: 1 };
  return [...alerts].sort((a, b) => {
    if (a.isStreamed !== b.isStreamed) return a.isStreamed ? -1 : 1;
    const scoreDiff = b.urgencyScore - a.urgencyScore;
    if (scoreDiff !== 0) return scoreDiff;
    const ua = urgencyRank[a.urgency] - urgencyRank[b.urgency];
    if (ua !== 0) return -ua;
    if (a.unread !== b.unread) return a.unread ? -1 : 1;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

export type HeroStat = {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  pulse?: boolean;
};

export function buildHeroStats(alerts: EnrichedAlert[], pulse: number): HeroStat[] {
  const live = alerts.filter((a) => a.isLive).length;
  const biggestMove = [...alerts]
    .filter((a) => a.movementSize != null)
    .sort((a, b) => (b.movementSize ?? 0) - (a.movementSize ?? 0))[0];
  const hottestBattle = alerts.find((a) => a.displayType === "BATTLE ESCALATION");
  const rising = alerts.find((a) => a.displayType === "REPUTATION MOVE");
  const marketMove = biggestMove?.related_market ?? "—";
  const repChange = rising?.related_agent ?? "—";
  const narrative = alerts.find((a) => a.displayType === "NARRATIVE BREAKOUT");
  const verifiedToday = alerts.filter((a) => a.type === "receipt").length + (pulse % 2);

  return [
    {
      label: "Active alerts",
      value: String(alerts.length),
      sub: `${live} live now`,
      pulse: true,
    },
    {
      label: "Largest conviction shift",
      value: biggestMove
        ? `${biggestMove.direction === "up" ? "+" : biggestMove.direction === "down" ? "" : ""}${biggestMove.probability_change ?? biggestMove.movementSize}pt`
        : "—",
      sub: biggestMove?.related_market ?? "",
      highlight: true,
    },
    {
      label: "Hottest battle",
      value: hottestBattle?.related_market?.slice(0, 28) ?? "—",
      sub: hottestBattle?.related_agent ?? "No active split",
    },
    {
      label: "Fastest rising agent",
      value: rising?.related_agent ?? "—",
      sub: rising ? `+${rising.reputationImpact ?? 3} reputation` : "",
    },
    {
      label: "Strongest market move",
      value: marketMove.length > 24 ? `${marketMove.slice(0, 24)}…` : marketMove,
      sub: biggestMove?.related_agent ?? "Realtime reprice",
    },
    {
      label: "Biggest reputation change",
      value: repChange,
      sub: rising?.narrative?.slice(0, 32) ?? "",
    },
    {
      label: "Narrative acceleration",
      value: narrative?.related_market?.slice(0, 26) ?? "Fed pivot cluster",
      sub: narrative?.related_agent ?? "Signal cluster heating",
    },
    {
      label: "Verified calls today",
      value: String(verifiedToday),
      sub: "Receipt-backed conviction",
      highlight: true,
    },
  ];
}

export type InsightCard = {
  id: string;
  label: string;
  value: string;
  sub: string;
  tone: string;
  href?: string;
};

export function buildAlertInsights(alerts: EnrichedAlert[]): InsightCard[] {
  const byMove = [...alerts].sort((a, b) => (b.movementSize ?? 0) - (a.movementSize ?? 0))[0];
  const contested = alerts.find((a) => a.battleRelated);
  const narrative = alerts.find((a) => a.displayType === "NARRATIVE BREAKOUT");
  const rep = alerts.find((a) => a.displayType === "REPUTATION MOVE");
  const contrarian = alerts.find((a) => a.tags.includes("contrarian"));
  const verified = alerts.find((a) => a.type === "receipt");
  const volatile = [...alerts]
    .filter((a) => a.probability_change != null)
    .sort((a, b) => Math.abs(b.probability_change ?? 0) - Math.abs(a.probability_change ?? 0))[0];
  const fracture = alerts.find((a) => a.displayType === "CONSENSUS SHIFT");

  return [
    {
      id: "move",
      label: "Biggest move",
      value: byMove?.related_market?.slice(0, 22) ?? "—",
      sub: byMove ? `${byMove.movementSize}pt shift` : "",
      tone: "violet",
      href: byMove?.marketSlug ? `/markets/${byMove.marketSlug}` : undefined,
    },
    {
      id: "contested",
      label: "Most contested",
      value: contested?.related_market?.slice(0, 22) ?? "—",
      sub: contested ? `${contested.related_agent} in battle` : "",
      tone: "rose",
      href: contested?.marketSlug ? `/markets/${contested.marketSlug}` : undefined,
    },
    {
      id: "narrative",
      label: "Narrative acceleration",
      value: narrative?.related_market?.slice(0, 22) ?? "AI capex cycle",
      sub: narrative?.related_agent ?? "Cluster heating",
      tone: "cyan",
      href: narrative?.marketSlug ? `/markets/${narrative.marketSlug}` : undefined,
    },
    {
      id: "rep",
      label: "Reputation breakout",
      value: rep?.related_agent ?? "—",
      sub: rep ? `+${rep.reputationImpact ?? 4} ranks` : "",
      tone: "amber",
      href: rep?.agentSlug ? `/agents/${rep.agentSlug}` : undefined,
    },
    {
      id: "contrarian",
      label: "Contrarian alert",
      value: contrarian?.related_agent ?? "ContrCap",
      sub: "Against crowded consensus",
      tone: "rose",
      href: contrarian?.agentSlug ? `/agents/${contrarian.agentSlug}` : undefined,
    },
    {
      id: "verified",
      label: "Verified call landed",
      value: verified?.related_agent ?? "—",
      sub: verified?.related_market?.slice(0, 28) ?? "",
      tone: "emerald",
      href: verified?.agentSlug ? `/agents/${verified.agentSlug}` : undefined,
    },
    {
      id: "volatile",
      label: "Volatility spike",
      value: volatile?.related_market?.slice(0, 22) ?? "—",
      sub: volatile ? `${volatile.probability_change}pt` : "",
      tone: "amber",
      href: volatile?.marketSlug ? `/markets/${volatile.marketSlug}` : undefined,
    },
    {
      id: "fracture",
      label: "Consensus fracture",
      value: fracture?.related_market?.slice(0, 22) ?? "—",
      sub: fracture?.narrative.slice(0, 32) ?? "",
      tone: "sky",
      href: fracture?.marketSlug ? `/markets/${fracture.marketSlug}` : undefined,
    },
  ];
}
