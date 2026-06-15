import type { EnrichedBattle } from "./types";

export type BattleChartNarrativeKind =
  | "challenged"
  | "doubled_down"
  | "receipt_verified"
  | "battle_joined";

export type BattleChartMarker = {
  id: string;
  agentName: string;
  agentSlug: string;
  at: string;
  kind: BattleChartNarrativeKind;
  headline: string;
  detail: string;
  historyIndex: number;
  probAtPoint: number;
};

const CHART_SPAN_MS = 7 * 24 * 60 * 60 * 1000;

function hash(s: string) {
  return s.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

function timeToHistoryIndex(at: string, historyLen: number): number {
  const age = Date.now() - new Date(at).getTime();
  const t = 1 - Math.min(1, Math.max(0, age / CHART_SPAN_MS));
  return Math.round(t * Math.max(0, historyLen - 1));
}

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600000).toISOString();
}

/** Synthetic probability path for agent A network win share (0–100). */
export function buildBattleProbHistory(battle: EnrichedBattle, currentPctA: number): number[] {
  const len = 28;
  const h = hash(battle.id);
  const end = currentPctA;
  const start = Math.max(8, Math.min(92, end - battle.spread_delta * 2 + ((h % 17) - 8)));
  const points: number[] = [];
  for (let i = 0; i < len; i++) {
    const t = i / (len - 1);
    const wave = Math.sin((i + h % 7) * 0.55) * (3 + (h % 4));
    const base = start + (end - start) * t;
    points.push(Math.round(Math.max(5, Math.min(95, base + wave * (1 - t * 0.6)))));
  }
  points[len - 1] = end;
  return points;
}

export function buildBattleChartMarkers(
  battle: EnrichedBattle,
  history: number[],
): BattleChartMarker[] {
  const takes = battle.recent_conflict?.takes ?? [];
  const takeA = takes.find((t) => t.agent.slug === battle.agent_a.slug);
  const takeB = takes.find((t) => t.agent.slug === battle.agent_b.slug);
  const challenger =
    battle.crowd_alignment.contrarian_slug === battle.agent_a.slug
      ? battle.agent_a
      : battle.agent_b;
  const leader =
    battle.crowd_alignment.favored_slug === battle.agent_a.slug
      ? battle.agent_a
      : battle.agent_b;
  const h = hash(battle.id);

  const baseAt = battle.recent_conflict?.at ?? hoursAgo(36);
  const idx = (at: string) => timeToHistoryIndex(at, history.length);

  const markers: BattleChartMarker[] = [
    {
      id: `${battle.id}-joined`,
      agentName: battle.agent_b.name,
      agentSlug: battle.agent_b.slug,
      at: hoursAgo(120 + (h % 48)),
      kind: "battle_joined",
      headline: `${battle.agent_b.name} joined battle`,
      detail: `Entered the ${battle.contested_market} thread`,
      historyIndex: idx(hoursAgo(120)),
      probAtPoint: history[idx(hoursAgo(120))] ?? 50,
    },
    {
      id: `${battle.id}-challenge`,
      agentName: challenger.name,
      agentSlug: challenger.slug,
      at: hoursAgo(72 + (h % 12)),
      kind: "challenged",
      headline: `${challenger.name} challenged`,
      detail: battle.recent_conflict?.summary ?? "Opened opposing conviction on the contested market",
      historyIndex: idx(hoursAgo(72)),
      probAtPoint: history[idx(hoursAgo(72))] ?? 50,
    },
    {
      id: `${battle.id}-receipt`,
      agentName:
        battle.agent_a.receipt_count >= battle.agent_b.receipt_count
          ? battle.agent_a.name
          : battle.agent_b.name,
      agentSlug:
        battle.agent_a.receipt_count >= battle.agent_b.receipt_count
          ? battle.agent_a.slug
          : battle.agent_b.slug,
      at: hoursAgo(28 + (h % 8)),
      kind: "receipt_verified",
      headline: "Receipt verified",
      detail: "Timing proof logged to verified archive",
      historyIndex: idx(hoursAgo(28)),
      probAtPoint: history[idx(hoursAgo(28))] ?? 50,
    },
    {
      id: `${battle.id}-double`,
      agentName: leader.name,
      agentSlug: leader.slug,
      at: baseAt,
      kind: "doubled_down",
      headline: `${leader.name} doubled down`,
      detail:
        takeA && takeB
          ? `${Math.max(takeA.confidence, takeB.confidence)}% conviction held under pressure`
          : battle.last_blow,
      historyIndex: idx(baseAt),
      probAtPoint: history[idx(baseAt)] ?? history[history.length - 1] ?? 50,
    },
  ];

  return markers.sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
}

export const BATTLE_NARRATIVE_STYLE: Record<
  BattleChartNarrativeKind,
  { dot: string; ring: string; label: string; svgFill: string; svgRing: string }
> = {
  challenged: {
    dot: "bg-amber-400",
    ring: "ring-amber-500/40",
    label: "text-amber-200/90",
    svgFill: "rgba(251,191,36,0.95)",
    svgRing: "rgba(251,191,36,0.35)",
  },
  doubled_down: {
    dot: "bg-rose-400",
    ring: "ring-rose-500/40",
    label: "text-rose-200/90",
    svgFill: "rgba(244,63,94,0.95)",
    svgRing: "rgba(244,63,94,0.35)",
  },
  receipt_verified: {
    dot: "bg-sky-400",
    ring: "ring-sky-500/40",
    label: "text-sky-200/90",
    svgFill: "rgba(56,189,248,0.95)",
    svgRing: "rgba(56,189,248,0.35)",
  },
  battle_joined: {
    dot: "bg-violet-400",
    ring: "ring-violet-500/40",
    label: "text-violet-200/90",
    svgFill: "rgba(167,139,250,0.95)",
    svgRing: "rgba(167,139,250,0.35)",
  },
};

export const BATTLE_NARRATIVE_LABEL: Record<BattleChartNarrativeKind, string> = {
  challenged: "Challenged",
  doubled_down: "Doubled down",
  receipt_verified: "Receipt verified",
  battle_joined: "Battle joined",
};
