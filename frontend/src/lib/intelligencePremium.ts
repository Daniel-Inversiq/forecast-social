import type { EnrichedAgentProfile } from "@/components/agents/profile/types";
import type { EnrichedMarketDetail } from "@/components/markets/detail/types";
import type { RankedAgent } from "@/components/leaderboards/types";
import type { EnrichedNarrative } from "@/components/narratives/types";
import type { GlobalDailyBrief } from "@/lib/dailyBrief";
import {
  buildBeforeConsensus,
  buildCoalitions,
  buildHiddenAlignments,
} from "@/components/narratives/signalIntelligence";
import { titleToSlug } from "@/lib/slugs";

function hash(...parts: string[]) {
  return parts.join("").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

/* ── Signals ── */

export type PremiumSignalRow = {
  id: string;
  title: string;
  stage: string;
  hiddenAlignment: string;
  coalitionConfidence: number;
  beforeConsensusProb: number;
  signalFragility: number;
  historicalAnalog: string;
  agents: string[];
};

export function buildPremiumSignals(narratives: EnrichedNarrative[]): PremiumSignalRow[] {
  const forming = narratives
    .filter(
      (n) =>
        n.signal_stage === "FORMING" ||
        n.signal_stage === "CLUSTERING" ||
        n.lifecycle_phase === "WEAK_SIGNAL" ||
        n.is_emerging,
    )
    .slice(0, 6);

  const pool = forming.length > 0 ? forming : narratives.slice(0, 6);
  const alignments = buildHiddenAlignments(narratives);
  const coalitions = buildCoalitions(narratives);
  const analogs = buildBeforeConsensus(narratives);

  return pool.map((n, i) => {
    const h = hash(n.id, String(i));
    const alignment = alignments[i % alignments.length];
    const coalition = coalitions[i % coalitions.length];
    const analog = analogs[i % analogs.length];
    return {
      id: n.id,
      title: n.title,
      stage: n.signal_stage,
      hiddenAlignment: alignment?.copy ?? n.early_signal_copy,
      coalitionConfidence: Math.round(
        (coalition?.internal_agreement ?? n.alignment) * 0.6 + (coalition?.influence_score ?? 50) * 0.4,
      ),
      beforeConsensusProb: Math.min(94, 18 + (h % 32) + Math.round(100 - n.alignment) * 0.35),
      signalFragility: Math.round(
        n.is_contrarian ? 62 + (h % 28) : 28 + (h % 22) + (n.pressure_direction === "fragmenting" ? 12 : 0),
      ),
      historicalAnalog: analog
        ? `${analog.signal_copy.slice(0, 72)}… · ${analog.lead_days}d lead`
        : `Analog: ${n.category} cluster ${2019 + (h % 5)} repricing arc`,
      agents: n.driver_agents.slice(0, 4),
    };
  });
}

/* ── Market ── */

export type PremiumMarketIntel = {
  factionStability: number;
  hiddenPressure: string;
  analogMarkets: { title: string; slug: string; similarity: number }[];
  verificationPathway: string;
  reputationWinners: { name: string; slug: string; reason: string }[];
  reputationLosers: { name: string; slug: string; reason: string }[];
  coalitionFractureRisk: number;
};

export function buildPremiumMarketIntel(market: EnrichedMarketDetail): PremiumMarketIntel {
  const h = hash(market.slug, market.title);
  const takes = market.agent_takes;
  const sorted = [...takes].sort(
    (a, b) => (b.reputation_score ?? 0) - (a.reputation_score ?? 0),
  );

  const yesRep = market.credibility.yes.total_reputation;
  const noRep = market.credibility.no.total_reputation;
  const stability = Math.round(
    100 -
      market.consensus_fragmentation * 0.45 -
      (market.contested_level === "extreme" ? 22 : market.contested_level === "high" ? 12 : 4),
  );

  const pressureInsight = market.pressure_insights[0];
  const pressure =
    (pressureInsight ? `${pressureInsight.label}: ${pressureInsight.value}` : null) ??
    market.why_moving.headline ??
    `${market.dominant_faction} faction pressure intensifying · ${market.timing_pressure}`;

  const analogTitles = [
    "Fed cut by Sep 2026",
    "US recession by Q4",
    "Major AI breakthrough before December",
    "Oil above $100",
    "BTC above 150k by year end",
  ].filter((t) => t !== market.title);

  const analogMarkets = analogTitles.slice(0, 3).map((title, i) => ({
    title,
    slug: titleToSlug(title),
    similarity: 68 + ((h + i * 11) % 24),
  }));

  const winners = sorted
    .filter((t) => t.side === (market.current_yes_probability >= 50 ? "YES" : "NO"))
    .slice(0, 2)
    .map((t) => ({
      name: t.name,
      slug: t.slug,
      reason: `Timing edge +${Math.round(t.timing_quality ?? 12)} · aligned with ${market.dominant_faction} bloc`,
    }));

  const losers = sorted
    .filter((t) => t.side !== (market.current_yes_probability >= 50 ? "YES" : "NO"))
    .slice(0, 2)
    .map((t) => ({
      name: t.name,
      slug: t.slug,
      reason: `Against flow · calibration drag if consensus holds`,
    }));

  if (winners.length === 0 && sorted[0]) {
    winners.push({
      name: sorted[0].name,
      slug: sorted[0].slug,
      reason: "Highest rep on dominant side",
    });
  }
  if (losers.length === 0 && sorted[1]) {
    losers.push({
      name: sorted[1].name,
      slug: sorted[1].slug,
      reason: "Contrarian exposure if fracture widens",
    });
  }

  const verifyProb = 38 + (h % 40) + Math.round(market.credibility.consensus_break_count * 4);

  return {
    factionStability: Math.max(12, Math.min(96, stability)),
    hiddenPressure: pressure,
    analogMarkets,
    verificationPathway: `Pathway confidence ${verifyProb}% · ${market.credibility.consensus_break_count} consensus breaks on tape · resolution likely via ${market.category.toLowerCase()} catalyst cluster`,
    reputationWinners: winners,
    reputationLosers: losers,
    coalitionFractureRisk: Math.round(
      market.consensus_fragmentation * 0.7 +
        (yesRep + noRep > 0 ? (Math.min(yesRep, noRep) / Math.max(yesRep, noRep, 1)) * 40 : 20) +
        (h % 15),
    ),
  };
}

/* ── Agent ── */

export type PremiumAgentIntel = {
  memorySummary: string;
  thesisHistory: { thesis: string; status: string; timing: string }[];
  rivalryHistory: { rival: string; slug: string; record: string }[];
  timingPattern: string;
  calibrationVulnerability: string;
  narrativeOwnership: { narrative: string; share: number }[];
};

export function buildPremiumAgentIntel(profile: EnrichedAgentProfile): PremiumAgentIntel {
  const h = hash(profile.slug);
  const rep = profile.reputation;

  const thesisHistory = profile.top_markets.slice(0, 4).map((m, i) => ({
    thesis: `${m.title} · ${m.probability >= 50 ? "YES" : "NO"} conviction arc`,
    status: i === 0 ? "Active" : i === 1 ? "Contested" : "Archived",
    timing: profile.positions[i]?.entry_timing ?? `${6 + (h % 10)}d early`,
  }));

  const rivalryHistory = profile.battles.slice(0, 4).map((b) => ({
    rival: b.rival,
    slug: b.rivalSlug,
    record:
      b.status === "won"
        ? `Won · +${b.reputation_swing ?? 4} rep`
        : b.status === "lost"
          ? `Lost · ${b.reputation_swing ?? -3} rep`
          : `Active · ${b.spread}pt spread`,
  }));

  const timingPattern =
    (rep?.timing_quality ?? profile.timing_quality) >= 70
      ? `${profile.name} historically gains edge during ${profile.strongest_narrative.toLowerCase()} fragmentation regimes.`
      : `${profile.name} shows strongest timing when entering before consensus on ${profile.niche} desks.`;

  const cal = rep?.calibration_score ?? profile.accuracy_score;
  const calibrationVulnerability =
    cal >= 75
      ? `Overconfidence risk in 70–85% buckets · watch late-cycle ${profile.niche} reversals.`
      : `Calibration soft spot in tail scenarios · vulnerable when consensus tightens above 80%.`;

  const narrativeOwnership =
    profile.narrative_clusters.length > 0
      ? profile.narrative_clusters
      : [{ label: profile.strongest_narrative, weight: 58 + (h % 28) }];

  return {
    memorySummary: `${profile.identity_line} Deep ledger: ${profile.enriched_receipts.length} verified arcs · ${profile.reputation?.consensus_breaks ?? 0} consensus breaks · ${profile.battles_won} battle wins recorded.`,
    thesisHistory,
    rivalryHistory,
    timingPattern,
    calibrationVulnerability,
    narrativeOwnership: narrativeOwnership.map((n) => ({
      narrative: n.label,
      share: n.weight,
    })),
  };
}

/* ── Rankings ── */

export type PremiumRankingsIntel = {
  migrationHighlights: { sector: string; flow: string; magnitude: number }[];
  fragilityAlerts: { agent: string; slug: string; alert: string }[];
  hiddenRisers: { agent: string; slug: string; signal: string }[];
  narrativeShifts: { narrative: string; direction: string }[];
  coalitionInfluence: { coalition: string; delta: string }[];
};

export function buildPremiumRankingsIntel(agents: RankedAgent[]): PremiumRankingsIntel {
  const fragile = [...agents]
    .filter((a) => a.trend === "down" || a.momentum_state === "fading" || a.momentum_state === "cooling")
    .slice(0, 4);

  const hiddenRisers = [...agents]
    .filter((a) => a.momentum_state === "rising" || (a.velocity ?? 0) >= 5)
    .sort((a, b) => (b.velocity ?? 0) - (a.velocity ?? 0))
    .slice(0, 4);

  const narratives = new Map<string, number>();
  agents.forEach((a) => {
    narratives.set(a.strongest_narrative, (narratives.get(a.strongest_narrative) ?? 0) + 1);
  });

  const narrativeShifts = [...narratives.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([narrative, count], i) => ({
      narrative,
      direction: i % 2 === 0 ? "Ownership concentrating" : "Fragmenting across desks",
    }));

  const sectors = ["Macro", "AI", "Politics", "Crypto"];
  const migrationHighlights = sectors.map((sector, i) => {
    const h = hash(sector, String(agents.length));
    const rising = agents.filter((a) => a.niche.toLowerCase().includes(sector.toLowerCase()) && a.trend === "up")
      .length;
    return {
      sector,
      flow: rising >= 2 ? "inflow" : rising === 0 ? "outflow" : "volatile",
      magnitude: 3 + (h % 12) + rising,
    };
  });

  return {
    migrationHighlights,
    fragilityAlerts: fragile.map((a) => ({
      agent: a.name,
      slug: a.slug,
      alert:
        a.momentum_state === "fading"
          ? "Leadership fragile · velocity negative"
          : "Rep concentration risk · downside skew",
    })),
    hiddenRisers: hiddenRisers.map((a) => ({
      agent: a.name,
      slug: a.slug,
      signal: `Quiet +${Math.round(a.velocity ?? a.rank_delta)} rep · ${a.narrative_specialization}`,
    })),
    narrativeShifts,
    coalitionInfluence: [
      { coalition: "Macro repricing bloc", delta: "+influence · 3 agents" },
      { coalition: "AI acceleration cluster", delta: "stable · high agreement" },
      { coalition: "Contrarian macro wing", delta: "+fracture pressure" },
    ],
  };
}

/* ── Deep Brief ── */

export type DeepBriefIntel = {
  deepParagraph: string;
  hiddenPressure: string;
  earlyConsensus: string;
  networkInstability: string;
  items: { label: string; value: string }[];
};

export function buildDeepBriefIntel(brief: GlobalDailyBrief): DeepBriefIntel {
  const h = hash(brief.date, brief.summary);
  const fractures = brief.sections.consensus_fractures;
  const rising = brief.sections.rising_narratives;
  const vol = brief.volatility_state;

  const hiddenPressure =
    fractures.length > 0
      ? `Hidden pressure building under ${fractures.map((n) => n.label).join(" · ")} — desk disagreement not yet reflected in headline consensus.`
      : "Silent repricing pressure detected across macro-linked clusters before public narrative shift.";

  const earlyConsensus =
    rising.length > 0
      ? `Early-forming consensus on ${rising[0].label} (${rising[0].strength} strength) — still pre-mainstream validation.`
      : "Weak consensus formation in AI and rates corridors — formation stage, not breakout.";

  const networkInstability =
    vol === "elevated" || vol === "active"
      ? `Network instability ${vol} · reputation migration elevated · ${brief.verified_calls_count} proof events anchoring volatility.`
      : `Network stable at surface · sub-surface coalition tension ${42 + (h % 30)}% on internal models.`;

  const deepParagraph = `${brief.summary} Intelligence layer: ${hiddenPressure} ${earlyConsensus} ${networkInstability}`;

  return {
    deepParagraph,
    hiddenPressure,
    earlyConsensus,
    networkInstability,
    items: [
      { label: "Hidden pressure", value: hiddenPressure.slice(0, 90) + "…" },
      { label: "Early consensus", value: earlyConsensus.slice(0, 90) + "…" },
      { label: "Network instability", value: networkInstability.slice(0, 90) + "…" },
      {
        label: "Rep migration",
        value:
          typeof (brief.top_reputation_move as { headline?: string })?.headline === "string"
            ? (brief.top_reputation_move as { headline: string }).headline
            : "Influence shifting toward timing-edge desks",
      },
    ],
  };
}
