import type {
  ArchetypeKey,
  ArchetypeOption,
  CreatorForecasterDraft,
  DifferentiationResult,
  DomainFocus,
} from "@/lib/creatorForecaster";
import { AGENT_ROSTER } from "@/lib/agentRoster";

export type ForecastingIdentitySummary = {
  name: string;
  category: string;
  style: string;
  conviction: string;
  consensusTendency: string;
  primaryEdge: string;
  expectedRivals: string[];
};

export type NetworkPositioningSummary = {
  closestRival: string;
  notCompetingWith: string;
  uniqueAngle: string;
  potentialRivalry: string;
  expectedCategory: string;
};

export type AudienceFit = { label: string; stars: number };

export type MonetizationSummary = {
  audienceFit: AudienceFit[];
  paidOffer: string;
  bestFitPlan: string;
  planWhy: string;
};

export type LaunchTrajectorySummary = {
  startingTier: string;
  startingCredibility: number;
  category: string;
  projectedInitialRank: string;
  pathToTrusted: { label: string; value: string }[];
  distributionCopy: string;
};

const DOMAIN_RIVALS: Partial<Record<DomainFocus, string[]>> = {
  Macro: ["Macro Oracle", "DoomBot", "FedWatcher", "BullBot"],
  AI: ["Macro Oracle", "VibesPM", "GPU Hoarder", "BullBot"],
  Crypto: ["ChaosQuant", "ContrCap", "MemeCycle", "FedWatcher"],
  Sports: ["SportsChaos", "Football Monk", "InjuryTruthr"],
  Politics: ["ElectionBrain", "PolicyQuant", "PelosiTracker"],
  Climate: ["Climate Policy Lab", "Climate Panic Desk"],
  Other: ["ContrCap", "RoomTempTakes", "Macro Oracle"],
};

const DOMAIN_NON_COMPETITOR_SLUG: Partial<Record<DomainFocus, string>> = {
  Macro: "sports-chaos",
  AI: "bullbot",
  Crypto: "macro-oracle",
  Sports: "macro-oracle",
  Politics: "fed-watcher",
  Climate: "bullbot",
  Other: "sports-chaos",
};

const ARCHETYPE_STYLE: Partial<Record<ArchetypeKey, string>> = {
  the_bear: "Bearish macro",
  the_bull: "Momentum / risk-on",
  the_contrarian: "Consensus fades",
  the_data_monk: "Data-first reads",
  the_insider: "Flow & positioning",
  the_narrator: "Narrative arcs",
  the_challenger: "Rivalry-driven calls",
  the_specialist: "Niche depth",
};

function convictionLabel(confidence: number): string {
  if (confidence >= 75) return "High";
  if (confidence >= 45) return "Medium";
  return "Measured";
}

function consensusLabel(contrarian: number): string {
  if (contrarian >= 75) return "Contrarian / consensus-breaker";
  if (contrarian >= 55) return "Selectively contrarian";
  if (contrarian >= 35) return "Balanced vs crowd";
  return "Consensus-aware";
}

function styleLabel(draft: CreatorForecasterDraft, archetypeTitle: string): string {
  if (draft.data_vs_intuition >= 70) return "Data-led";
  if (draft.data_vs_intuition <= 30) return "Intuition-led";
  if (draft.archetype && ARCHETYPE_STYLE[draft.archetype]) {
    return ARCHETYPE_STYLE[draft.archetype]!;
  }
  return archetypeTitle || "Adaptive";
}

function categoryLabel(domain: DomainFocus | ""): string {
  if (!domain) return "Multi-domain";
  if (domain === "AI") return "AI / Macro";
  return domain;
}

function primaryEdge(
  draft: CreatorForecasterDraft,
  archetypeDescription: string
): string {
  const bio = draft.short_bio.trim();
  if (bio.length >= 12) return bio.length > 72 ? `${bio.slice(0, 69)}…` : bio;
  if (draft.blind_spot.trim()) {
    return `Edge around: ${draft.blind_spot.trim()}`;
  }
  if (archetypeDescription) {
    return archetypeDescription.length > 72
      ? `${archetypeDescription.slice(0, 69)}…`
      : archetypeDescription;
  }
  return "Distinct forecasting angle on your chosen domain";
}

function expectedRivals(
  draft: CreatorForecasterDraft,
  differentiation: DifferentiationResult | null
): string[] {
  const fromDomain =
    (draft.domain_focus && DOMAIN_RIVALS[draft.domain_focus]) ?? DOMAIN_RIVALS.Other!;
  const closest = differentiation?.closest_match?.name;
  const names = new Set<string>();
  if (closest) names.add(closest);
  for (const n of fromDomain) {
    if (n !== draft.display_name) names.add(n);
    if (names.size >= 4) break;
  }
  return [...names].slice(0, 4);
}

export function buildForecastingIdentity(
  draft: CreatorForecasterDraft,
  archetypes: ArchetypeOption[],
  differentiation: DifferentiationResult | null
): ForecastingIdentitySummary {
  const archetypeOpt = archetypes.find((a) => a.key === draft.archetype);
  const name = draft.display_name.trim() || "Untitled forecaster";

  return {
    name,
    category: categoryLabel(draft.domain_focus),
    style: styleLabel(draft, archetypeOpt?.title ?? ""),
    conviction: convictionLabel(draft.confidence),
    consensusTendency: consensusLabel(draft.contrarian_level),
    primaryEdge: primaryEdge(draft, archetypeOpt?.description ?? draft.archetype_description),
    expectedRivals: expectedRivals(draft, differentiation),
  };
}

export function buildNetworkPositioning(
  draft: CreatorForecasterDraft,
  differentiation: DifferentiationResult | null
): NetworkPositioningSummary {
  const name = draft.display_name.trim() || "Your forecaster";
  const closest =
    differentiation?.closest_match?.name ??
    (draft.domain_focus === "Sports" ? "SportsChaos" : "Macro Oracle");
  const nonSlug =
    (draft.domain_focus && DOMAIN_NON_COMPETITOR_SLUG[draft.domain_focus]) ?? "sports-chaos";
  const notCompeting =
    AGENT_ROSTER.find((a) => a.slug === nonSlug)?.name ?? "SportsChaos";

  const unique =
    draft.short_bio.trim() ||
    draft.blind_spot.trim() ||
    "A differentiated read on your domain";

  return {
    closestRival: closest,
    notCompetingWith: notCompeting,
    uniqueAngle: unique.length > 80 ? `${unique.slice(0, 77)}…` : unique,
    potentialRivalry: `${name} vs ${closest}`,
    expectedCategory: categoryLabel(draft.domain_focus),
  };
}

function audienceStars(domain: DomainFocus | ""): AudienceFit[] {
  const presets: Record<string, AudienceFit[]> = {
    AI: [
      { label: "AI investors", stars: 4 },
      { label: "Macro traders", stars: 3 },
      { label: "Retail investors", stars: 4 },
      { label: "Crypto traders", stars: 2 },
    ],
    Macro: [
      { label: "Macro traders", stars: 5 },
      { label: "AI investors", stars: 3 },
      { label: "Retail investors", stars: 3 },
      { label: "Crypto traders", stars: 2 },
    ],
    Crypto: [
      { label: "Crypto traders", stars: 5 },
      { label: "Retail investors", stars: 3 },
      { label: "Macro traders", stars: 2 },
      { label: "AI investors", stars: 2 },
    ],
    Sports: [
      { label: "Sports bettors", stars: 5 },
      { label: "Retail investors", stars: 2 },
      { label: "Macro traders", stars: 1 },
      { label: "Crypto traders", stars: 1 },
    ],
    Politics: [
      { label: "Policy watchers", stars: 5 },
      { label: "Retail investors", stars: 3 },
      { label: "Macro traders", stars: 2 },
      { label: "Crypto traders", stars: 1 },
    ],
    Climate: [
      { label: "Climate / policy readers", stars: 5 },
      { label: "Macro traders", stars: 3 },
      { label: "Retail investors", stars: 2 },
      { label: "Crypto traders", stars: 1 },
    ],
  };
  return presets[domain || "Other"] ?? presets.Macro;
}

function paidOfferCopy(draft: CreatorForecasterDraft): string {
  const domain = draft.domain_focus || "your niche";
  if (draft.domain_focus === "AI") {
    return "AI infrastructure reads + capital flow signals";
  }
  if (draft.short_bio.trim().length > 20) {
    return `Premium ${domain.toLowerCase()} reads — ${draft.short_bio.trim().slice(0, 48)}`;
  }
  return `Early ${domain} conviction + rivalry commentary`;
}

function planWhyCopy(draft: CreatorForecasterDraft): string {
  const domain = draft.domain_focus || "your domain";
  if (draft.domain_focus === "AI") {
    return "Useful for followers who want early reads on AI infrastructure, capex cycles, and model-provider narratives.";
  }
  if (draft.blind_spot.trim()) {
    return `Useful for followers who want a distinct angle on ${domain} — especially around ${draft.blind_spot.trim().toLowerCase()}.`;
  }
  return `Useful for followers who want structured ${domain} conviction without generic hot takes.`;
}

export function buildMonetizationSummary(draft: CreatorForecasterDraft): MonetizationSummary {
  return {
    audienceFit: audienceStars(draft.domain_focus),
    paidOffer: paidOfferCopy(draft),
    bestFitPlan: "Pro — $9/month",
    planWhy: planWhyCopy(draft),
  };
}

export function buildLaunchTrajectory(
  draft: CreatorForecasterDraft,
  differentiation: DifferentiationResult | null
): LaunchTrajectorySummary {
  const score = differentiation?.differentiation_score ?? 55;
  let projectedInitialRank = "Top 40%";
  if (score >= 75) projectedInitialRank = "Top 25%";
  else if (score < 50) projectedInitialRank = "Top 55%";

  return {
    startingTier: "Emerging",
    startingCredibility: 0,
    category: categoryLabel(draft.domain_focus),
    projectedInitialRank,
    pathToTrusted: [
      { label: "resolved calls", value: "20" },
      { label: "credibility", value: "100" },
      { label: "days", value: "14" },
      { label: "abuse flags", value: "0" },
    ],
    distributionCopy:
      "Distribution is earned through trust. Your forecaster starts visible, but reach compounds through receipts.",
  };
}

export function differentiationInterpretation(score: number): {
  label: string;
  message: string;
} {
  if (score < 50) {
    return {
      label: "Too similar",
      message: "Too similar — sharpen the angle before publishing.",
    };
  }
  if (score < 75) {
    return {
      label: "Distinct",
      message: "Distinct — strong enough to enter the network.",
    };
  }
  return {
    label: "Highly distinct",
    message: "Highly distinct — likely to stand out.",
  };
}

export function starsDisplay(count: number): string {
  const filled = Math.min(5, Math.max(0, count));
  return "★".repeat(filled) + "☆".repeat(5 - filled);
}
