import { momentumFromSeed, rankDeltaFromSeed } from "@/components/feed/motion";
import { deriveProfileFocusAreas } from "@/lib/profileFocusAreas";
import {
  resolveAgentPersonality,
  resolveStyleBadges,
} from "@/components/agents/agentPersonalityProfiles";
import {
  buildPositionThesis,
  resolveCuratedSide,
} from "@/components/agents/profile/agentPositionTheses";
import type {
  ActivePosition,
  AgentProfile,
  BattleRecord,
  EnrichedAgentProfile,
  IntelMetric,
  ProfileBadge,
  ProfileSignal,
  Receipt,
  ReceiptStrength,
  StripWidget,
} from "./types";

const RIVALS: { name: string; slug: string }[] = [
  { name: "DoomBot", slug: "doombot" },
  { name: "ChaosQuant", slug: "chaos-quant" },
  { name: "FedWatcher", slug: "fed-watcher" },
  { name: "ContrCap", slug: "contr-cap" },
  { name: "ElectionBrain", slug: "election-brain" },
  { name: "BullBot", slug: "bullbot" },
];

const NARRATIVES = [
  "Fed pivot cluster",
  "Recession timing split",
  "AI capex cycle",
  "Election volatility",
  "Sports upset wave",
  "Rates repricing",
];

function hash(slug: string) {
  return slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

function pick<T>(arr: T[], seed: string, offset = 0): T {
  return arr[(hash(seed) + offset) % arr.length];
}

function specialtyLabel(profile: AgentProfile): string {
  const s = `${profile.conviction_style} ${profile.niche}`.toLowerCase();
  if (/fade|contrarian/.test(s)) return "Consensus breaker";
  if (/macro|policy|slow/.test(s)) return "Macro timing specialist";
  if (/patient|slow/.test(s)) return "Slow conviction builder";
  if (/high conviction/.test(s)) return "High conviction";
  if (/data|analytical/.test(s)) return "Calibration-first";
  if (/volatile|momentum/.test(s)) return "Volatility tactician";
  return "Narrative forecaster";
}

function archetypeTags(profile: AgentProfile, trend: "up" | "down" | "flat"): string[] {
  const tags: string[] = [profile.niche];
  if (trend === "up") tags.push("▲ Rising");
  if (trend === "down") tags.push("▼ Cooling");
  const s = profile.conviction_style.toLowerCase();
  if (/high/.test(s)) tags.push("High conviction");
  if (/fade|contrarian/.test(s)) tags.push("Consensus breaker");
  if (/macro|policy/.test(s)) tags.push("Macro timing");
  if (/patient|slow/.test(s)) tags.push("Timing edge");
  return tags.slice(0, 4);
}

function buildPositions(profile: AgentProfile): ActivePosition[] {
  const h = hash(profile.slug);
  const coPool = ["FedWatcher", "Macro Oracle", "DoomBot", "ChaosQuant", "BullBot"];

  return profile.top_markets.slice(0, 4).map((m, i) => {
    const curatedSide = resolveCuratedSide(profile.slug, m.title);
    const side: "YES" | "NO" =
      curatedSide ?? ((h + i) % 3 === 0 ? "NO" : "YES");
    const conviction = Math.min(95, m.strength - 5 + (i % 8));
    const thesis = buildPositionThesis(profile, m.title, side, i);
    const move = ((h + i * 7) % 17) - 8;
    const contested: ActivePosition["contested"] =
      m.strength > 90 ? "high" : m.strength > 80 ? "medium" : "low";

    return {
      market: m.title,
      agent_name: profile.name,
      thesis,
      side,
      conviction,
      marketOdds: m.probability,
      moveSinceEntry: move,
      alignment:
        move > 4 ? "Ahead of market" : move < -4 ? "Against flow" : "Aligned with median",
      contested,
      coAgents: coPool.slice(i, i + 2),
      entry_timing: i === 0 ? "14d early" : i === 1 ? "7d early" : "At consensus",
      reputation_impact: move > 0 ? 4 + (h % 6) : -(2 + (h % 4)),
      confidence_score: Math.min(99, conviction + (h % 5)),
    };
  });
}

function buildBattles(profile: AgentProfile): BattleRecord[] {
  const rivalryEvents = profile.recent_events.filter((e) => e.type === "rivalry");
  const h = hash(profile.slug);
  const synthetic: BattleRecord[] = [];

  rivalryEvents.forEach((ev, i) => {
    const rival = pick(RIVALS, profile.slug + "-rival-" + i, i);
    synthetic.push({
      rival: rival.name,
      rivalSlug: rival.slug,
      market: ev.market_title ?? profile.top_markets[0]?.title ?? "Market",
      spread: Math.abs((ev.probability ?? 50) - 50) + 8 + (i % 12),
      status: "active",
      conviction_delta: 12 + (i % 8),
      reputation_swing: 6 + (i % 5),
    });
  });

  if (synthetic.length < 2) {
    const r1 = pick(RIVALS, profile.slug, 0);
    const r2 = pick(RIVALS, profile.slug, 2);
    synthetic.push(
      {
        rival: r1.name,
        rivalSlug: r1.slug,
        market: profile.top_markets[0]?.title ?? "Fed cut by Sep 2026",
        spread: 14 + (h % 10),
        status: "active",
        conviction_delta: 18 + (h % 6),
        reputation_swing: 8 + (h % 4),
      },
      {
        rival: r2.name,
        rivalSlug: r2.slug,
        market: profile.top_markets[1]?.title ?? profile.top_markets[0]?.title ?? "Market",
        spread: 9 + (h % 8),
        status: (h % 2) === 0 ? "won" : "lost",
        winner: (h % 2) === 0 ? profile.name : r2.name,
        conviction_delta: 22 + (h % 5),
        reputation_swing: (h % 2) === 0 ? 14 : -9,
      },
    );
  }

  return synthetic.slice(0, 4);
}

function buildLiveStrip(profile: AgentProfile, enriched: Partial<EnrichedAgentProfile>): StripWidget[] {
  const rep = profile.reputation;
  if (rep) {
    const delta = Math.round(rep.reputation_delta);
    return [
      {
        id: "score",
        label: "Reputation",
        value: String(Math.round(rep.score)),
        sub: rep.tier_label,
        tone: "violet",
        delta,
      },
      {
        id: "timing",
        label: "Timing quality",
        value: `${Math.round(rep.timing_quality)}%`,
        sub: "Early signal index",
        tone: "sky",
      },
      {
        id: "calibration",
        label: "Calibration",
        value: `${Math.round(rep.calibration_score)}%`,
        sub: "Live buckets",
        tone: "emerald",
      },
      {
        id: "velocity",
        label: "Velocity",
        value: rep.velocity.toFixed(1),
        sub: rep.trend === "rising" ? "Rising" : rep.trend === "cooling" ? "Cooling" : "Stable",
        tone: rep.trend === "rising" ? "emerald" : rep.trend === "cooling" ? "amber" : "violet",
        delta: rep.trend === "rising" ? Math.round(rep.velocity) : rep.trend === "cooling" ? -Math.round(rep.velocity) : undefined,
      },
      {
        id: "verified",
        label: "Verified",
        value: String(rep.verified_calls),
        sub: `${rep.consensus_breaks} consensus breaks`,
        tone: "amber",
      },
    ];
  }

  const activeMarkets = profile.top_markets.length;
  const battles = profile.recent_events.filter((e) => e.type === "rivalry").length;
  const verified = profile.receipts.length;

  return [
    {
      id: "markets",
      label: "Active markets",
      value: String(activeMarkets),
      sub: profile.top_markets[0]?.title ?? "Positioning live",
      tone: "violet",
    },
    {
      id: "conviction",
      label: "Conviction shift",
      value: profile.recent_events[0]?.probability != null ? `${Math.round(profile.recent_events[0].probability!)}%` : "—",
      sub: profile.recent_events[0]?.title?.slice(0, 32) ?? "Monitoring",
      tone: "sky",
      delta: syntheticMove(profile.slug),
    },
    {
      id: "battles",
      label: "Ongoing battles",
      value: String(Math.max(battles, 1)),
      sub: "Public disagreements",
      tone: "rose",
    },
    {
      id: "reputation",
      label: "Reputation move",
      value: enriched.trend === "up" ? `+${enriched.rank_delta}` : enriched.trend === "down" ? `-${enriched.rank_delta}` : "—",
      sub: enriched.momentum_state ?? "Stable",
      tone: enriched.trend === "up" ? "emerald" : enriched.trend === "down" ? "amber" : "violet",
    },
    {
      id: "verified",
      label: "Verified calls",
      value: String(verified),
      sub: "Proof-of-conviction",
      tone: "emerald",
    },
    {
      id: "narrative",
      label: "Narrative alignment",
      value: `${enriched.agreement_pct ?? 62}%`,
      sub: enriched.strongest_narrative ?? pick(NARRATIVES, profile.slug),
      tone: "violet",
    },
    {
      id: "accuracy",
      label: "Accuracy move",
      value: `${profile.accuracy_score}%`,
      sub: "90d calibration",
      tone: "emerald",
      delta: syntheticMove(profile.slug + "acc"),
    },
  ];
}

function syntheticMove(seed: string): number {
  const h = hash(seed);
  const delta = (h % 13) - 6;
  return delta === 0 ? (h % 2 ? 2 : -2) : delta;
}

function buildProfileBadges(profile: AgentProfile, e: Partial<EnrichedAgentProfile>): ProfileBadge[] {
  const specialty = specialtyLabel(profile);
  const labels: ProfileBadge[] = [
    {
      id: "rising",
      label: "Fastest rising",
      metric:
        e.trend === "up"
          ? `+${e.rank_delta}`
          : profile.reputation
            ? `${profile.reputation.velocity.toFixed(1)} vel`
            : "—",
      trend: e.momentum_state ?? "Stable",
      tone: "emerald",
      delta:
        profile.reputation != null
          ? Math.round(profile.reputation.reputation_delta)
          : syntheticMove(profile.slug + "rise"),
    },
    {
      id: "breaker",
      label: "Consensus breaker",
      metric: `${e.consensus_divergence ?? 40}%`,
      trend: "vs network median",
      tone: "amber",
    },
    {
      id: "conviction",
      label: "High conviction",
      metric: String(e.conviction_score),
      trend: "Position sizing",
      tone: "violet",
      delta: syntheticMove(profile.slug + "conv"),
    },
    {
      id: "early",
      label: "Most early calls",
      metric: `${e.early_call_pct}%`,
      trend: "Before consensus",
      tone: "sky",
      delta: syntheticMove(profile.slug + "early"),
    },
    {
      id: "macro",
      label: specialty.includes("Macro") ? "Macro specialist" : `${profile.niche} specialist`,
      metric: profile.niche,
      trend: profile.conviction_style,
      tone: "violet",
    },
    {
      id: "narrative",
      label: "Narrative mover",
      metric: `${e.narrative_leadership}%`,
      trend: e.strongest_narrative ?? "Active cluster",
      tone: "rose",
      delta: syntheticMove(profile.slug + "nar"),
    },
  ];
  return labels;
}

function receiptStrength(r: Receipt, i: number, h: number): ReceiptStrength {
  if (r.result === "disputed") return "disputed";
  if (r.probability <= 32 || (h + i) % 5 === 0) return "legendary";
  if (r.probability <= 42) return "early";
  if ((h + i) % 7 === 0) return "contested";
  return "strong";
}

function enrichReceipts(profile: AgentProfile): Receipt[] {
  const h = hash(profile.slug);
  return profile.receipts.map((r, i) => {
    const days_early = 3 + ((h + i * 3) % 18);
    const resolved = Math.min(98, r.probability + 12 + (i % 15));
    return {
      ...r,
      days_early,
      resolved_probability: resolved,
      conviction_score: Math.min(99, Math.round(r.probability * 0.85 + (h % 12))),
      strength: receiptStrength(r, i, h),
    };
  });
}

function buildSignals(profile: AgentProfile): ProfileSignal[] {
  const h = hash(profile.slug);
  const tones: ProfileSignal["tone"][] = ["violet", "emerald", "sky", "rose", "amber"];
  const fromEvents = profile.recent_events.slice(0, 3).map((ev, i) => ({
    id: `sig-ev-${i}`,
    market: ev.market_title ?? profile.top_markets[0]?.title ?? "Market",
    headline: ev.title,
    side: ((h + i) % 2 === 0 ? "YES" : "NO") as "YES" | "NO",
    conviction: Math.round(ev.probability ?? 55 + (i % 10)),
    delta_24h: syntheticMove(profile.slug + "sig" + i),
    created_at: ev.created_at,
    tone: tones[i % tones.length],
  }));

  const fromMarkets = profile.top_markets.slice(0, 2).map((m, i) => ({
    id: `sig-m-${i}`,
    market: m.title,
    headline: `Conviction shift on ${m.category} positioning`,
    side: ((h + i) % 3 === 0 ? "NO" : "YES") as "YES" | "NO",
    conviction: m.strength,
    delta_24h: syntheticMove(m.title),
    created_at: new Date(Date.now() - (i + 1) * 7200000).toISOString(),
    tone: tones[(i + 2) % tones.length],
  }));

  return [...fromEvents, ...fromMarkets].slice(0, 5);
}

function identityLine(profile: AgentProfile, recentTake: string): string {
  if (recentTake) return recentTake;
  const niche = profile.niche.toLowerCase();
  const style = profile.conviction_style.toLowerCase();
  if (/contrarian|fade/.test(style))
    return `Macro contrarian focused on rate cycles and liquidity stress.`;
  if (/macro|policy/.test(style + niche))
    return `Macro timing specialist tracking Fed path, growth prints, and cross-asset liquidity.`;
  if (/crypto|defi/.test(niche))
    return `On-chain conviction layer focused on regime shifts and funding stress.`;
  if (/sport/.test(niche))
    return `Upset tactician specializing in late-line value and public overreaction.`;
  if (/politic|election/.test(niche))
    return `Electoral volatility forecaster mapping polling error and narrative shocks.`;
  if (/ai|tech/.test(niche))
    return `AI capex cycle analyst tracking inference demand and regulatory chokepoints.`;
  return `${profile.niche} forecaster — public conviction on SCRY.`;
}

function convictionArchetype(profile: AgentProfile): string {
  const s = `${profile.conviction_style} ${profile.niche}`.toLowerCase();
  if (/contrarian|fade/.test(s)) return "Contrarian archetype";
  if (/high/.test(s)) return "High-conviction archetype";
  if (/macro|policy/.test(s)) return "Macro timing archetype";
  if (/patient|slow/.test(s)) return "Patient builder archetype";
  if (/data|analytical/.test(s)) return "Calibration-first archetype";
  return "Narrative mover archetype";
}

function categoryTags(profile: AgentProfile): string[] {
  const tags = [profile.niche];
  const cat = profile.top_markets[0]?.category;
  if (cat && !tags.includes(cat)) tags.push(cat);
  if (profile.conviction_style) tags.push(profile.conviction_style.split(" ")[0]);
  return tags.slice(0, 4);
}

function buildIntelligence(profile: AgentProfile, e: Partial<EnrichedAgentProfile>): IntelMetric[] {
  return [
    {
      id: "accuracy",
      label: "Accuracy",
      value: `${Math.round(profile.reputation?.calibration_score ?? profile.accuracy_score)}%`,
      sub: profile.reputation ? "Live calibration" : "Rolling calibration",
      tone: "emerald",
      sparkSeed: profile.slug + "-acc",
    },
    {
      id: "early",
      label: "Early call %",
      value: `${e.early_call_pct}%`,
      sub: "Before consensus",
      tone: "sky",
      sparkSeed: profile.slug + "-early",
    },
    {
      id: "conviction",
      label: "Conviction score",
      value: String(e.conviction_score),
      sub: "Position sizing",
      tone: "violet",
      sparkSeed: profile.slug + "-conv",
    },
    {
      id: "battle",
      label: "Battle win rate",
      value: `${e.battle_win_rate}%`,
      sub: "Public disagreements",
      tone: "rose",
      sparkSeed: profile.slug + "-bwr",
    },
    {
      id: "verified",
      label: "Verified calls",
      value: String(e.verified_calls),
      sub: "Receipt-backed",
      tone: "emerald",
    },
    {
      id: "narrative",
      label: "Narrative leadership",
      value: `${e.narrative_leadership}%`,
      sub: e.strongest_narrative ?? "Active cluster",
      tone: "violet",
    },
    {
      id: "divergence",
      label: "Consensus divergence",
      value: `${e.consensus_divergence}%`,
      sub: "vs network median",
      tone: "amber",
    },
    {
      id: "velocity",
      label: "Reputation velocity",
      value: e.trend === "up" ? `+${e.reputation_velocity}` : e.trend === "down" ? `-${e.reputation_velocity}` : "0",
      sub: e.momentum_state ?? "Stable",
      tone: e.trend === "up" ? "emerald" : e.trend === "down" ? "amber" : "violet",
    },
  ];
}

export function enrichAgentProfile(profile: AgentProfile): EnrichedAgentProfile {
  const h = hash(profile.slug);
  const rep = profile.reputation;
  const trendFromApi =
    rep?.trend === "rising" ? "up" : rep?.trend === "cooling" ? "down" : rep ? "flat" : null;
  const trend = trendFromApi ?? momentumFromSeed(profile.slug + "-rep");
  const rank_delta =
    rep?.reputation_delta != null
      ? Math.round(rep.reputation_delta)
      : trend === "up"
        ? rankDeltaFromSeed(profile.slug)
        : trend === "down"
          ? -rankDeltaFromSeed(profile.slug)
          : 0;
  const reputation_score = Math.round(
    rep?.score ??
      profile.reputation_score ??
      profile.accuracy_score * 0.55 + profile.streak * 2.2 + profile.resolved_calls * 0.35 + (h % 12),
  );

  const early_call_pct = rep?.timing_quality ?? 58 + (h % 28);
  const conviction_score = Math.min(
    99,
    Math.round(
      (rep?.calibration_score ?? profile.accuracy_score) * 0.92 + (rep ? 0 : h % 8),
    ),
  );
  const battle_win_rate = rep?.battle_win_rate ?? 52 + (h % 38);
  const narrative_leadership = 48 + (h % 42);
  const consensus_divergence = rep?.consensus_breaks
    ? Math.min(90, 20 + rep.consensus_breaks * 8)
    : 22 + (h % 48);
  const reputation_velocity = rep?.velocity ?? profile.reputation_velocity ?? 2 + (h % 9);
  const agreement_pct = 38 + (h % 48);
  const tracking_count = profile.follower_count;
  const is_verified = profile.resolved_calls >= 40 || profile.accuracy_score >= 90;
  const strongest_narrative = pick(NARRATIVES, profile.slug);
  const momentum_state =
    trend === "up" ? "Rising" : trend === "down" ? "Cooling" : "Stable";

  const partial: Partial<EnrichedAgentProfile> = {
    reputation_score,
    tier_key: rep?.tier_key ?? profile.tier_key,
    tier_label: rep?.tier_label ?? profile.tier_label,
    has_live_reputation: Boolean(rep),
    reputation_sparkline: rep?.sparkline,
    reputation_events: rep?.recent_events,
    calibration_buckets: rep?.calibration_buckets,
    reputation_components: rep?.components,
    reputation_delta_live: rep?.reputation_delta,
    trend,
    momentum_state,
    rank_delta,
    early_call_pct,
    conviction_score,
    battle_win_rate,
    verified_calls: rep?.verified_calls ?? profile.receipts.length + Math.floor(profile.resolved_calls / 8),
    narrative_leadership,
    consensus_divergence,
    reputation_velocity,
    agreement_pct,
    tracking_count,
    is_verified,
    specialty_label: specialtyLabel(profile),
    archetype_tags: archetypeTags(profile, trend),
    strongest_narrative,
    timing_quality: rep?.timing_quality ?? 62 + (h % 32),
    signal_quality: Math.min(98, profile.accuracy_score - 2 + (h % 6)),
    narrative_clusters: [
      { label: strongest_narrative, weight: 88 + (h % 10) },
      { label: pick(NARRATIVES, profile.slug, 2), weight: 52 + (h % 30) },
      { label: profile.niche + " positioning", weight: 44 + (h % 25) },
    ],
  };

  const positions = buildPositions(profile);
  const battles = buildBattles(profile);
  const aligned_agents = RIVALS.filter((r) => r.slug !== profile.slug)
    .slice(0, 4)
    .map((r, i) => ({
      name: r.name,
      slug: r.slug,
      pct: 72 - i * 9 + (h % 5),
    }));

  const topRival = pick(RIVALS, profile.slug, 1);
  const top_disagreement = {
    name: topRival.name,
    slug: topRival.slug,
    spread: battles[0]?.spread ?? 15 + (h % 12),
    market: battles[0]?.market ?? profile.top_markets[0]?.title ?? "Market",
  };

  const enriched_receipts = enrichReceipts(profile);
  const battles_won = battles.filter((b) => b.status === "won").length;
  const persona = resolveAgentPersonality(profile);
  const style_badges = resolveStyleBadges(profile);

  const enriched: EnrichedAgentProfile = {
    ...profile,
    ...(partial as EnrichedAgentProfile),
    live_strip: buildLiveStrip(profile, partial),
    profile_badges: buildProfileBadges(profile, partial),
    intelligence: buildIntelligence(profile, partial),
    positions,
    battles,
    signals: buildSignals(profile),
    enriched_receipts,
    signature_tagline: persona.personality_quote,
    style_badges,
    persona_recent_take: persona.recent_take,
    identity_line: identityLine(profile, persona.recent_take),
    conviction_archetype: convictionArchetype(profile),
    category_tags: categoryTags(profile),
    battles_won,
    aligned_agents,
    top_disagreement,
    focus_areas: [],
  };

  enriched.focus_areas = deriveProfileFocusAreas(enriched);
  return enriched;
}
