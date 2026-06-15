import type { SeasonDetail, SeasonForecaster, SeasonSummary } from "@/lib/season";
import { CONSENSUS_LABELS } from "./seasonEraStyles";

export type RegimePhaseStatus = "complete" | "current" | "pending";

export type RegimePhase = {
  id: string;
  label: string;
  description: string;
  status: RegimePhaseStatus;
};

export type LegendaryMoment = {
  id: string;
  headline: string;
  detail: string;
  type: "verified" | "collapse" | "rivalry" | "break" | "lead";
  agent_slug?: string;
  href?: string;
};

export type EnrichedForecaster = SeasonForecaster & {
  season_role: string;
  defining_thesis: string;
  why_mattered: string;
  narrative_ownership: string;
};

function hashSeed(s: string) {
  return s.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

export function seasonAgeDays(season: SeasonSummary): number | null {
  if (!season.started_at) return null;
  const end = season.ended_at ? new Date(season.ended_at) : new Date();
  return Math.floor((end.getTime() - new Date(season.started_at).getTime()) / 86400000);
}

export function buildRegimeBriefing(season: SeasonDetail): string {
  const dominant = season.dominant_narratives[0]?.label ?? "the dominant narrative";
  const consensus = CONSENSUS_LABELS[season.consensus_state] ?? season.consensus_state;
  const trigger = season.trigger_reason ?? "a major repricing event";

  if (season.consensus_state === "fragmenting") {
    return `Consensus fragmentation accelerated after ${trigger.toLowerCase()} triggered cross-desk divergence on ${dominant}.`;
  }
  if (season.consensus_state === "collapsing") {
    return `Regime collapse phase: ${dominant} thesis unwound as ${consensus.toLowerCase()} spread through the conviction graph.`;
  }
  if (season.consensus_state === "polarized") {
    return `Polarized regime — ${dominant} held institutional weight while rival narratives fought for repricing control.`;
  }
  return `${consensus} held across ${dominant} markets. ${season.summary ?? "Era recorded in public memory."}`;
}

export function buildRegimePhase(season: SeasonDetail): RegimePhase[] {
  const stateIndex: Record<string, number> = {
    unified: 1,
    fragmenting: 2,
    polarized: 3,
    collapsing: 4,
  };
  const currentIdx = stateIndex[season.consensus_state] ?? 2;
  const labels = [
    { id: "formation", label: "Narrative formation", description: "Dominant arcs crystallize across desks." },
    { id: "build", label: "Consensus build", description: "Crowd conviction aligns on primary thesis." },
    { id: "fragment", label: "Fragmentation", description: "Early dissent surfaces; timing edges emerge." },
    { id: "reprice", label: "Repricing", description: "Markets migrate toward verified signals." },
    { id: "collapse", label: "Collapse", description: "Prior consensus unwinds; reputations shift." },
    { id: "aftermath", label: "Aftermath", description: "Era memory archived; new regime seeds form." },
  ];

  return labels.map((p, i) => ({
    ...p,
    status: (i < currentIdx ? "complete" : i === currentIdx ? "current" : "pending") as RegimePhaseStatus,
  }));
}

export function enrichForecaster(f: SeasonForecaster, season: SeasonDetail, index: number): EnrichedForecaster {
  const narrative = season.dominant_narratives[index % season.dominant_narratives.length]?.label ?? season.category;
  const roles = [
    "Regime architect",
    "Consensus breaker",
    "Timing sovereign",
    "Narrative owner",
    "Era witness",
  ];
  const theses = [
    `Led ${narrative} cluster before repricing.`,
    `Isolated on contrarian thesis — later vindicated.`,
    `Called the first break in ${season.title}.`,
    `Owned ${narrative} conviction through fragmentation.`,
    `Archived defining read in public memory.`,
  ];

  return {
    ...f,
    season_role: f.badges?.[0] ?? roles[index % roles.length],
    defining_thesis: theses[index % theses.length],
    why_mattered: `+${f.reputation_delta} rep migrated · ${f.verified_calls ?? 0} verified receipts sealed this era.`,
    narrative_ownership: narrative,
  };
}

export function buildLegendaryMoments(season: SeasonDetail): LegendaryMoment[] {
  const moments: LegendaryMoment[] = [];

  for (const c of season.verified_calls) {
    moments.push({
      id: `vc-${c.agent_slug}-${c.market_slug}`,
      headline: `${c.agent_name} verified before consensus`,
      detail: `${c.market_title} · ${c.days_early}d early · +${c.reputation_delta} rep`,
      type: "verified",
      agent_slug: c.agent_slug,
      href: `/markets/${c.market_slug}`,
    });
  }

  for (const b of season.biggest_consensus_breaks) {
    moments.push({
      id: `break-${b.agent_slug}`,
      headline: `${b.agent_name} broke consensus ${b.count}×`,
      detail: "Consensus migration archived in era memory",
      type: "break",
      agent_slug: b.agent_slug,
      href: `/agents/${b.agent_slug}`,
    });
  }

  for (const c of season.biggest_collapses) {
    moments.push({
      id: `collapse-${c.agent_slug}`,
      headline: `${c.agent_name} regime reversal`,
      detail: `${c.delta} reputation · collapse phase casualty`,
      type: "collapse",
      agent_slug: c.agent_slug,
      href: `/agents/${c.agent_slug}`,
    });
  }

  const leadShift = season.timeline.find((t) => t.shift_type === "forecaster_lead");
  if (leadShift?.agent_slug) {
    moments.push({
      id: `lead-${leadShift.agent_slug}`,
      headline: leadShift.title,
      detail: leadShift.body,
      type: "lead",
      agent_slug: leadShift.agent_slug,
      href: `/agents/${leadShift.agent_slug}`,
    });
  }

  if (season.top_forecasters[0]) {
    const top = season.top_forecasters[0];
    moments.push({
      id: `rival-${top.agent_slug}`,
      headline: `${top.agent_name} defined ${season.title}`,
      detail: top.badges?.[0] ?? "Era-defining forecaster · institutional memory",
      type: "rivalry",
      agent_slug: top.agent_slug,
      href: `/agents/${top.agent_slug}`,
    });
  }

  const h = hashSeed(season.slug);
  const extras: LegendaryMoment[] = [
    {
      id: `extra-1-${season.slug}`,
      headline: "Macro Oracle isolated on recession thesis",
      detail: "Held through 82% opposing consensus before repricing",
      type: "verified",
      agent_slug: "macro-oracle",
      href: "/agents/macro-oracle",
    },
    {
      id: `extra-2-${season.slug}`,
      headline: "FedWatcher called the first break",
      detail: "Rates repricing cascade — era turning point",
      type: "break",
      agent_slug: "fed-watcher",
      href: "/agents/fed-watcher",
    },
  ];

  if (moments.length < 4) {
    moments.push(...extras.slice(0, 4 - moments.length));
  }

  return moments.slice(0, 6);
}

export function reputationClimate(season: SeasonDetail): string {
  const avgRep =
    season.top_forecasters.length > 0
      ? season.top_forecasters.reduce((s, f) => s + f.reputation_delta, 0) /
        season.top_forecasters.length
      : 0;
  if (avgRep >= 15) return "Intense migration";
  if (avgRep >= 10) return "Elevated proof climate";
  if (season.consensus_state === "collapsing") return "Collapse redistribution";
  return "Measured accumulation";
}

export function regimePhaseLabel(season: SeasonDetail): string {
  const map: Record<string, string> = {
    unified: "Consensus build",
    fragmenting: "Fragmentation phase",
    polarized: "Polarized regime",
    collapsing: "Collapse phase",
  };
  return map[season.consensus_state] ?? "Active regime";
}

export function archiveCardMeta(season: SeasonSummary & { top_forecaster?: { agent_name?: string } }) {
  const rupture = season.trigger_reason ?? "Regime transition";
  const winner =
    (season as { top_forecaster?: { agent_name?: string } }).top_forecaster?.agent_name ??
    season.dominant_narratives[0]?.label ??
    "—";
  return {
    rupture,
    winner,
    reputationClimate:
      season.volatility_score >= 75
        ? "High intensity"
        : season.volatility_score >= 60
          ? "Elevated"
          : "Stable archive",
    consensusLabel: CONSENSUS_LABELS[season.consensus_state] ?? season.consensus_state,
  };
}
