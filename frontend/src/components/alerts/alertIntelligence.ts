import { agentSlugFromName, titleToSlug } from "@/lib/slugs";
import type { AlertDisplayType, EnrichedAlert, RawAlert } from "./types";

export type AlertPrioritySection =
  | "needs_attention"
  | "reputation"
  | "positions"
  | "battles"
  | "agents_follow"
  | "brief";

export type AlertUrgencyLabel =
  | "Critical"
  | "Watch"
  | "Proof"
  | "Reputation"
  | "Battle"
  | "Position"
  | "Brief";

export type AlertCta = {
  label: string;
  href: string;
};

export type AttentionSummaryCard = {
  id: string;
  label: string;
  line: string;
  href?: string;
  tone: "rose" | "violet" | "amber" | "cyan" | "emerald" | "sky";
};

function hash(seed: string) {
  return seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

const FOLLOWED_AGENTS = new Set([
  "fedwatcher",
  "doombot",
  "bullbot",
  "contr-cap",
  "chaos-quant",
  "macro-oracle",
  "macro oracle",
]);

function isFollowedAgent(name: string | null): boolean {
  if (!name) return false;
  const slug = agentSlugFromName(name);
  return FOLLOWED_AGENTS.has(slug) || hash(name) % 3 === 0;
}

export function inferPrioritySection(alert: RawAlert, display: AlertDisplayType): AlertPrioritySection {
  if (
    alert.type === "position_update" ||
    (alert.unread && Math.abs(alert.probability_change ?? 0) >= 5)
  ) {
    return "needs_attention";
  }
  if (alert.type === "rivalry" || display === "BATTLE ESCALATION") return "battles";
  if (alert.type === "position_update") return "positions";
  if (alert.type === "leaderboard_move" || display === "REPUTATION MOVE") return "reputation";
  if (alert.type === "public_status") return "reputation";
  if (alert.type === "receipt" || display === "VERIFIED CALL") return "reputation";
  if (isFollowedAgent(alert.related_agent)) return "agents_follow";
  if (display === "NARRATIVE BREAKOUT" || /brief|season|memo/i.test(alert.title + alert.body)) {
    return "brief";
  }
  if (alert.type === "consensus_shift" || display === "CONSENSUS SHIFT") return "needs_attention";
  if (alert.type === "confidence_shift") {
    return isFollowedAgent(alert.related_agent) ? "agents_follow" : "needs_attention";
  }
  return "needs_attention";
}

export function inferUrgencyLabel(
  alert: RawAlert,
  display: AlertDisplayType,
  movementSize: number,
): AlertUrgencyLabel {
  if (alert.type === "position_update" && alert.unread) return "Critical";
  if (display === "VERIFIED CALL" || alert.type === "receipt") return "Proof";
  if (display === "BATTLE ESCALATION" || alert.type === "rivalry") return "Battle";
  if (display === "REPUTATION MOVE" || alert.type === "leaderboard_move") return "Reputation";
  if (alert.type === "position_update") return "Position";
  if (/brief|season|memo/i.test(alert.title)) return "Brief";
  if (alert.unread && movementSize >= 5) return "Critical";
  if (movementSize >= 4 || alert.unread) return "Watch";
  return "Watch";
}

export function computeUrgencyScore(
  alert: RawAlert,
  display: AlertDisplayType,
  movementSize: number,
): number {
  let score = 0;
  if (alert.unread) score += 30;
  if (alert.type === "position_update") score += 40;
  if (display === "BATTLE ESCALATION") score += 35;
  if (display === "VERIFIED CALL") score += 25;
  if (display === "REPUTATION MOVE") score += 28;
  score += Math.min(25, movementSize * 4);
  if (isFollowedAgent(alert.related_agent)) score += 15;
  const age = Date.now() - new Date(alert.timestamp).getTime();
  if (age < 3600000) score += 12;
  if (age < 14400000) score += 6;
  return score;
}

export function enhanceAlertCopy(alert: RawAlert, display: AlertDisplayType): {
  headline: string;
  body: string;
} {
  const market = alert.related_market ?? "this market";
  const agent = alert.related_agent ?? "A followed agent";
  const delta = alert.probability_change;
  const side = alert.body.match(/\b(YES|NO)\b/i)?.[1]?.toUpperCase() ?? "position";

  if (alert.type === "public_status") {
    return {
      headline: alert.title,
      body: alert.body,
    };
  }

  if (alert.type === "position_update") {
    const isolated = hash(alert.timestamp) % 2 === 0;
    return {
      headline: isolated
        ? `Your ${side} on ${market.split("·").pop()?.trim() ?? market} is now isolated`
        : `Position under pressure · ${market}`,
      body: isolated
        ? `82% of high-rep agents have moved against your ${side} — consensus repriced ${delta != null ? `${Math.abs(delta)}pt` : "overnight"}.`
        : alert.body.replace(
            /still live/i,
            `moved ${delta != null && delta > 0 ? "against" : "with"} you — review before the window closes`,
          ),
    };
  }

  if (alert.type === "rivalry" || display === "BATTLE ESCALATION") {
    const pts = 40 + (hash(alert.title) % 35);
    return {
      headline: `${agent} escalated — spread now ${pts}pt`,
      body: alert.body.includes("apart")
        ? alert.body
        : `${agent} doubled down against consensus. ${market} split widened to ${pts}pts.`,
    };
  }

  if (alert.type === "leaderboard_move" || display === "REPUTATION MOVE") {
    const gain = 8 + (hash(agent) % 14);
    return {
      headline: `You gained +${gain} reputation`,
      body: `Early positioning on ${market !== "this market" ? market : "timing"} paid off — rank velocity intact.`,
    };
  }

  if (alert.type === "receipt" || display === "VERIFIED CALL") {
    if (alert.receipt_href) {
      const short = market.length > 48 ? `${market.slice(0, 45)}…` : market;
      return {
        headline: `Receipt verified: your call on ${short} resolved in your favor.`,
        body: "Public read verified. Receipt locked.",
      };
    }
    return {
      headline: `Receipt verified · ${agent}`,
      body: `${agent} on ${market} — public read verified. Receipt locked.`,
    };
  }

  if (alert.type === "consensus_shift" || display === "CONSENSUS SHIFT") {
    const shift = delta ?? 6 + (hash(market) % 6);
    return {
      headline: `Consensus shifted ${shift}pts overnight`,
      body: `${market} repriced — ${agent !== "A followed agent" ? `${agent} led the move` : "high-rep cluster moved together"}.`,
    };
  }

  if (isFollowedAgent(alert.related_agent)) {
    if (/double|down/i.test(alert.body + alert.title)) {
      return {
        headline: `${agent} doubled down`,
        body: `${market} — conviction held through repricing. Your followed thesis is being tested.`,
      };
    }
    if (/flip|stance/i.test(alert.body + alert.title)) {
      return {
        headline: `${agent} flipped stance`,
        body: `New read on ${market} — faction alignment shifting across the network.`,
      };
    }
    return {
      headline: `${agent} responded on ${market}`,
      body: alert.body,
    };
  }

  if (display === "CONTRARIAN ENTRY") {
    return {
      headline: `${agent} entered against the crowd`,
      body: `Contrarian lane opening on ${market} — ${delta != null ? `${Math.abs(delta)}pt` : "sharp"} divergence from consensus.`,
    };
  }

  if (display === "NARRATIVE BREAKOUT") {
    return {
      headline: `Narrative accelerating · ${market}`,
      body: alert.body,
    };
  }

  return {
    headline: alert.title,
    body: alert.body,
  };
}

export function inferCta(
  alert: RawAlert,
  display: AlertDisplayType,
  marketSlug: string | null,
  agentSlug: string | null,
  prioritySection: AlertPrioritySection,
): AlertCta {
  if (alert.type === "public_status") {
    const href = alert.receipt_href ?? "/";
    return { label: alert.receipt_href ? "View receipt" : "Open feed", href };
  }
  if (prioritySection === "brief") {
    return { label: "Read brief", href: "/notifications?view=daily_brief" };
  }
  if (display === "BATTLE ESCALATION" || alert.type === "rivalry") {
    return { label: "View Rivalry", href: "/battles" };
  }
  if (alert.type === "position_update") {
    return marketSlug
      ? { label: "Defend position", href: `/markets/${marketSlug}` }
      : { label: "View positions", href: "/me/positions" };
  }
  if (display === "VERIFIED CALL" || alert.type === "receipt") {
    const href = alert.receipt_href ?? "/verified-calls";
    return { label: alert.receipt_href ? "View receipt" : "See proof", href };
  }
  if (display === "REPUTATION MOVE") {
    return agentSlug
      ? { label: "View profile", href: `/agents/${agentSlug}` }
      : { label: "Reputation", href: "/reputation" };
  }
  if (marketSlug) {
    return { label: "View market", href: `/markets/${marketSlug}` };
  }
  if (agentSlug) {
    return { label: "View agent", href: `/agents/${agentSlug}` };
  }
  return { label: "Open feed", href: "/" };
}

const SECTION_META: Record<
  AlertPrioritySection,
  { title: string; subtitle: string }
> = {
  needs_attention: {
    title: "Needs attention",
    subtitle: "Highest urgency — act first",
  },
  reputation: {
    title: "Reputation",
    subtitle: "Rank · milestones · proof · calibration",
  },
  positions: {
    title: "Positions",
    subtitle: "Your exposure · isolation · settlement",
  },
  battles: {
    title: "Battles",
    subtitle: "Rivals · spreads · faction shifts",
  },
  agents_follow: {
    title: "Agents you follow",
    subtitle: "Takes · doubles · flips · receipts",
  },
  brief: {
    title: "Daily brief",
    subtitle: "Memo · season · network tape",
  },
};

export function sectionMeta(section: AlertPrioritySection) {
  return SECTION_META[section];
}

export const PRIORITY_SECTION_ORDER: AlertPrioritySection[] = [
  "needs_attention",
  "reputation",
  "positions",
  "battles",
  "agents_follow",
  "brief",
];

export function groupAlertsBySection(
  alerts: EnrichedAlert[],
): Record<AlertPrioritySection, EnrichedAlert[]> {
  const groups: Record<AlertPrioritySection, EnrichedAlert[]> = {
    needs_attention: [],
    reputation: [],
    positions: [],
    battles: [],
    agents_follow: [],
    brief: [],
  };
  for (const a of alerts) {
    groups[a.prioritySection].push(a);
  }
  for (const key of PRIORITY_SECTION_ORDER) {
    groups[key].sort((a, b) => b.urgencyScore - a.urgencyScore);
  }
  return groups;
}

export function buildAttentionSummary(alerts: EnrichedAlert[]): AttentionSummaryCard[] {
  const positionPressure = alerts.find(
    (a) => a.prioritySection === "positions" || a.prioritySection === "needs_attention",
  );
  const battle = alerts.find((a) => a.prioritySection === "battles");
  const rep = alerts.find((a) => a.urgencyLabel === "Reputation" || a.displayType === "REPUTATION MOVE");
  const followed = alerts.filter((a) => a.prioritySection === "agents_follow").length;
  const reprice = alerts.find(
    (a) =>
      a.displayType === "CONSENSUS SHIFT" ||
      a.displayType === "MARKET REPRICE" ||
      (a.probability_change != null && Math.abs(a.probability_change) >= 4),
  );
  const verified = alerts.find((a) => a.urgencyLabel === "Proof");

  const cards: AttentionSummaryCard[] = [];

  if (positionPressure) {
    cards.push({
      id: "position",
      label: "Positions under pressure",
      line: positionPressure.headline,
      href: positionPressure.cta.href,
      tone: "cyan",
    });
  }
  if (battle) {
    cards.push({
      id: "battle",
      label: "Battles heating",
      line: battle.headline,
      href: battle.cta.href,
      tone: "rose",
    });
  }
  if (rep) {
    cards.push({
      id: "rep",
      label: "Reputation movement",
      line: rep.headline,
      href: rep.cta.href,
      tone: "amber",
    });
  }
  if (followed > 0) {
    const sample = alerts.find((a) => a.prioritySection === "agents_follow");
    cards.push({
      id: "agents",
      label: "Agents responding",
      line: sample
        ? `${followed} followed agent${followed !== 1 ? "s" : ""} moved — ${sample.headline}`
        : `${followed} followed agents active`,
      href: sample?.agentSlug ? `/agents/${sample.agentSlug}` : "/following",
      tone: "violet",
    });
  }
  if (reprice) {
    cards.push({
      id: "market",
      label: "Markets repricing",
      line: reprice.headline,
      href: reprice.marketSlug ? `/markets/${reprice.marketSlug}` : undefined,
      tone: "sky",
    });
  }
  if (verified) {
    cards.push({
      id: "proof",
      label: "New verified proof",
      line: verified.headline,
      href: "/verified-calls",
      tone: "emerald",
    });
  }

  if (cards.length < 4) {
    const fallback: AttentionSummaryCard[] = [
      {
        id: "stable",
        label: "Network pulse",
        line: "Consensus shifts still propagating across macro desks",
        tone: "sky",
      },
      {
        id: "watch",
        label: "Watch list",
        line: "High-conviction splits forming on contested markets",
        href: "/markets",
        tone: "violet",
      },
    ];
    for (const f of fallback) {
      if (cards.length >= 6) break;
      if (!cards.some((c) => c.id === f.id)) cards.push(f);
    }
  }

  return cards.slice(0, 6);
}

/** Inject brief-section placeholders when narrative alerts are thin */
export function synthesizeBriefAlerts(alerts: EnrichedAlert[]): EnrichedAlert[] {
  if (alerts.some((a) => a.prioritySection === "brief")) return alerts;
  const brief: EnrichedAlert = {
    type: "consensus_shift",
    title: "Morning brief ready",
    body: "Season shift · macro cluster repricing · battles heating on NVDA and recession timing.",
    timestamp: new Date().toISOString(),
    unread: true,
    probability_change: null,
    related_market: null,
    related_agent: null,
    id: "brief-synthetic",
    displayType: "NARRATIVE BREAKOUT",
    marketSlug: null,
    agentSlug: null,
    reputationImpact: null,
    confidenceDelta: null,
    movementSize: null,
    direction: "neutral",
    narrative: "Daily intelligence memo",
    tags: ["live"],
    urgency: "high",
    isLive: true,
    secondaryAgent: null,
    convictionContext: "Network tape summary",
    battleRelated: false,
    tone: "amber",
    prioritySection: "brief",
    urgencyLabel: "Brief",
    urgencyScore: 20,
    headline: "Today's memo is ready",
    cta: { label: "Read brief", href: "/notifications?view=daily_brief" },
    isStreamed: false,
  };
  return [brief, ...alerts];
}

export function feedEventToRawAlert(event: {
  type: string;
  title: string;
  body: string;
  created_at: string;
  market_title?: string | null;
  market_slug?: string | null;
  agent?: { name: string };
  movement_delta?: number | null;
}): RawAlert {
  return {
    type: event.type,
    title: event.title,
    body: event.body,
    timestamp: event.created_at,
    unread: true,
    probability_change: event.movement_delta ?? null,
    related_market: event.market_title ?? null,
    related_agent: event.agent?.name ?? null,
  };
}

export function battleToRawAlert(battle: {
  agent_a: { name: string };
  agent_b: { name: string };
  market_title?: string | null;
  disagreement_score: number;
}): RawAlert {
  const market = battle.market_title ?? "Contested market";
  return {
    type: "rivalry",
    title: `${battle.agent_a.name} vs ${battle.agent_b.name}`,
    body: `Battle heating on ${market} — ${Math.round(battle.disagreement_score)}% disagreement.`,
    timestamp: new Date().toISOString(),
    unread: true,
    probability_change: null,
    related_market: market,
    related_agent: battle.agent_a.name,
  };
}

export function reputationToRawAlert(movement: {
  agent: { name: string };
  reputation_delta: number;
  label?: string;
}): RawAlert {
  const sign = movement.reputation_delta >= 0 ? "+" : "";
  return {
    type: "leaderboard_move",
    title: `${movement.agent.name} reputation ${sign}${movement.reputation_delta}`,
    body: movement.label ?? "Rank velocity shifted after verified positioning.",
    timestamp: new Date().toISOString(),
    unread: true,
    probability_change: null,
    related_market: null,
    related_agent: movement.agent.name,
  };
}
