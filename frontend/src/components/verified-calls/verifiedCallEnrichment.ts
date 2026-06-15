import type {
  AgentProofRank,
  EnrichedVerifiedCall,
  TimelinePhase,
  VerificationChain,
  VerificationStreak,
  VerificationSurfaceModule,
  VerifiedCallBase,
  VerifiedCallFilterKey,
  VerifiedCallInsight,
  VerifiedCallSortKey,
} from "./types";

function hashSeed(...parts: string[]) {
  return parts.join("").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

const SEASONS = [
  { slug: "macro-cycle-w21", title: "Macro Cycle W21", role: "defining verification" },
  { slug: "soft-landing-era", title: "Soft Landing Era", role: "turning point" },
  { slug: "ai-acceleration-w12", title: "AI Acceleration W12", role: "fragmentation catalyst" },
  { slug: "sports-injury-w8", title: "Sports Injury W8", role: "cascade verification" },
];

const AMPLIFIERS = [
  { name: "FedWatcher", slug: "fed-watcher" },
  { name: "ContrCap", slug: "contr-cap" },
  { name: "BullBot", slug: "bullbot" },
  { name: "InjuryTruth", slug: "injury-truth" },
  { name: "Neural Scout", slug: "neural-scout" },
];

const NARRATIVES = [
  "Rates repricing",
  "Soft landing",
  "AI acceleration",
  "Injury cascade",
  "Recession risk",
  "H100 shortage",
];

export function inferCategory(market: string): string {
  const t = market.toLowerCase();
  if (/btc|crypto|eth/i.test(t)) return "Crypto";
  if (/fed|recession|macro|rent|oil|inflation|cut/i.test(t)) return "Macro";
  if (/election|debate|politic|incumbent/i.test(t)) return "Politics";
  if (/ai|neural|breakthrough|nvda|h100|acceleration/i.test(t)) return "AI";
  if (/league|football|sport|champion|premier|injury/i.test(t)) return "Sports";
  if (/carbon|climate|grid|energy policy/i.test(t)) return "Climate";
  return "Macro";
}

function fallbackReputationDelta(call: VerifiedCallBase): number {
  const base =
    call.receipt_strength === "legendary"
      ? 42
      : call.receipt_strength === "early"
        ? 28
        : call.receipt_strength === "contested"
          ? 22
          : 14;
  return base + Math.floor(call.days_early / 3) + Math.floor(call.confidence / 25);
}

function resolveReputationDelta(call: VerifiedCallBase, is_verified: boolean): number {
  if (typeof call.reputation_delta === "number") {
    return call.reputation_delta;
  }
  return is_verified ? fallbackReputationDelta(call) : -Math.floor(call.confidence / 20);
}

function buildReputationImpactSummary(call: VerifiedCallBase, is_verified: boolean): string {
  const delta = resolveReputationDelta(call, is_verified);
  const sign = delta >= 0 ? "+" : "";
  const parts: string[] = [`${sign}${delta} reputation`];

  if (call.consensus_breaking) {
    parts.push("consensus-breaking");
  }
  if (call.timing_multiplier != null) {
    parts.push(`timing ×${call.timing_multiplier}`);
  }
  if (call.conviction_multiplier != null) {
    parts.push(`conviction ×${call.conviction_multiplier}`);
  }
  if (call.calibration_impact != null && call.calibration_impact > 0) {
    parts.push(`calibration +${call.calibration_impact}`);
  }
  if (call.tier_impact) {
    parts.push(call.tier_impact);
  } else if (call.tier_label && is_verified) {
    parts.push(call.tier_label);
  }

  const source = call.reputation_live ? "live engine" : "estimated";
  return `${parts.join(" · ")} (${source})`;
}

function buildReputationImpactNarrative(call: VerifiedCallBase, is_verified: boolean): string {
  if (call.reputation_reason) {
    return call.reputation_reason;
  }
  if (!is_verified) {
    return "Reputation adjusted — conviction without consensus alignment";
  }
  if (call.consensus_breaking) {
    return "Contrarian verified call — consensus-break scoring applied";
  }
  if (call.receipt_strength === "legendary") {
    return "Legendary timing and conviction — top-tier reputation gain";
  }
  return `Verified public record · ${call.days_early}d before crowd repriced`;
}

function contestedScore(call: VerifiedCallBase): number {
  if (call.receipt_strength === "contested") return 72 + (hashSeed(call.id) % 22);
  if (call.receipt_strength === "legendary") return 55 + (hashSeed(call.id, "leg") % 20);
  return 20 + (hashSeed(call.id, "c") % 35);
}

function buildTimelinePhases(call: VerifiedCallBase, ignored: boolean): TimelinePhase[] {
  const base: TimelinePhase[] = [
    "thesis_opened",
    "early_signal",
    ignored ? "mocked_ignored" : "pressure_builds",
    "consensus_shifts",
    "market_reprices",
    "verified",
    "reputation_migrates",
  ];
  if (!ignored && call.days_early >= 10) {
    return [
      "thesis_opened",
      "early_signal",
      "pressure_builds",
      "consensus_shifts",
      "market_reprices",
      "verified",
      "reputation_migrates",
    ];
  }
  return base;
}

export function enrichVerifiedCall(call: VerifiedCallBase): EnrichedVerifiedCall {
  const is_verified = call.final_outcome === call.side;
  const h = hashSeed(call.id, call.market_title);
  const move = is_verified
    ? Math.min(48, Math.max(8, Math.round(100 - call.original_probability)))
    : Math.round((h % 18) + 5);
  const final_probability =
    call.side === "YES"
      ? is_verified
        ? Math.min(98, call.original_probability + move)
        : Math.max(12, call.original_probability - move)
      : is_verified
        ? Math.max(8, call.original_probability - move)
        : Math.min(88, call.original_probability + move);

  const agents = ["Macro Oracle", "DoomBot", "ContrCap", "FedWatcher", "BullBot"];
  const dissenter = agents[h % agents.length];

  const reputation_delta = resolveReputationDelta(call, is_verified);
  const reputation_from_engine =
    call.reputation_live === true || typeof call.reputation_delta === "number";

  const isolation_score = Math.min(
    98,
    Math.max(
      12,
      100 -
        call.original_probability +
        (call.consensus_breaking ? 18 : 0) +
        (h % 12),
    ),
  );
  const rep_density_at_entry = Math.max(2, 28 - Math.floor(call.days_early / 2) + (h % 8));
  const narrative_resistance = Math.min(94, 40 + (h % 35) + (call.receipt_strength === "contested" ? 20 : 0));
  const verification_velocity = Math.min(99, 55 + call.days_early * 2 + (h % 15));
  const verification_delay_days = Math.max(1, call.days_early - (h % 3));
  const pressure_shift = Math.abs(final_probability - call.original_probability);

  const ignored_at_first =
    call.consensus_breaking ||
    call.original_probability <= 28 ||
    (call.side === "NO" && call.original_probability >= 72) ||
    call.receipt_strength === "contested";

  const season = SEASONS[h % SEASONS.length];
  const ampCount = 1 + (h % 3);
  const amplifiers = Array.from({ length: ampCount }, (_, i) => AMPLIFIERS[(h + i) % AMPLIFIERS.length]);

  const firstSignal = new Date(
    new Date(call.created_at).getTime() - call.days_early * 86400000,
  ).toISOString();

  return {
    ...call,
    category: inferCategory(call.market_title),
    is_verified,
    reputation_delta,
    tier_key: call.tier_key,
    tier_label: call.tier_label,
    tier_impact: call.tier_impact,
    timing_multiplier: call.timing_multiplier,
    timing_quality: call.timing_quality,
    calibration_impact: call.calibration_impact,
    conviction_multiplier: call.conviction_multiplier,
    consensus_breaking: call.consensus_breaking ?? false,
    consensus_at_time: call.original_probability,
    final_consensus: final_probability,
    final_probability,
    what_changed: is_verified
      ? `Consensus migrated ${pressure_shift}pt toward ${call.side} after public positioning.`
      : "Market resolved against early conviction — archived for the public record.",
    why_mattered: is_verified
      ? `Timing receipt: ${call.days_early}d before the crowd repriced ${call.market_title}.`
      : "High-conviction miss — still part of reputation calibration.",
    who_disagreed: `${dissenter} and ${3 + (h % 5)} agents held the opposite side at archive time.`,
    reputation_impact: buildReputationImpactNarrative(call, is_verified),
    reputation_impact_summary: buildReputationImpactSummary(call, is_verified),
    reputation_from_engine,
    contested_score: contestedScore(call),
    receipt_id: `SCR-${call.id.replace(/\D/g, "").slice(-6).padStart(6, "0") || String(h % 999999).padStart(6, "0")}`,
    isolation_score,
    rep_density_at_entry,
    narrative_resistance,
    verification_velocity,
    verification_delay_days,
    pressure_shift,
    season_slug: season.slug,
    season_title: season.title,
    season_role: season.role,
    first_signal_at: firstSignal,
    amplifiers,
    timeline_phases: buildTimelinePhases(call, ignored_at_first),
    ignored_at_first,
    mock_label: ignored_at_first
      ? `${Math.round(100 - call.original_probability)}% consensus against · isolated ${call.days_early}d`
      : undefined,
    linked_narratives: [
      NARRATIVES[h % NARRATIVES.length],
      NARRATIVES[(h + 2) % NARRATIVES.length],
    ],
    linked_rivalries:
      h % 2 === 0 ? [`${call.agent_slug} vs ${dissenter.toLowerCase().replace(/\s/g, "-")}`] : [],
    coalition_agents: amplifiers.map((a) => a.name),
    downstream_battles: 1 + (h % 4),
    chain_id: `chain-${(h % 4) + 1}`,
  };
}

const FILTER_FN: Record<VerifiedCallFilterKey, (c: EnrichedVerifiedCall) => boolean> = {
  all: () => true,
  today: (c) => {
    const d = new Date(c.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  },
  legendary: (c) => c.receipt_strength === "legendary",
  contrarian: (c) => c.consensus_breaking || c.ignored_at_first,
  high_conviction: (c) => c.confidence >= 85,
  most_isolated: (c) => c.isolation_score >= 70,
  fastest_repricing: (c) => c.verification_velocity >= 80,
  before_consensus: (c) => c.days_early >= 10,
  seasonal: (c) => !!c.season_slug,
  coalition: (c) => c.coalition_agents.length >= 2,
  narrative_defining: (c) => c.receipt_strength === "legendary" || c.pressure_shift >= 35,
  early: (c) => c.receipt_strength === "early" || c.days_early >= 10,
  contested: (c) => c.receipt_strength === "contested" || c.contested_score >= 60,
  macro: (c) => c.category === "Macro",
  politics: (c) => c.category === "Politics",
  crypto: (c) => c.category === "Crypto",
  ai: (c) => c.category === "AI",
  sports: (c) => c.category === "Sports",
  climate: (c) => c.category === "Climate",
};

export function filterVerifiedCalls(
  calls: EnrichedVerifiedCall[],
  filter: VerifiedCallFilterKey,
  query: string,
): EnrichedVerifiedCall[] {
  const q = query.trim().toLowerCase();
  return calls.filter((c) => {
    if (!FILTER_FN[filter](c)) return false;
    if (!q) return true;
    return (
      c.agent_name.toLowerCase().includes(q) ||
      c.market_title.toLowerCase().includes(q) ||
      c.original_take.toLowerCase().includes(q) ||
      c.season_title.toLowerCase().includes(q) ||
      c.linked_narratives.some((n) => n.toLowerCase().includes(q)) ||
      c.receipt_id.toLowerCase().includes(q)
    );
  });
}

export function sortVerifiedCalls(
  calls: EnrichedVerifiedCall[],
  sort: VerifiedCallSortKey,
): EnrichedVerifiedCall[] {
  const copy = [...calls];
  switch (sort) {
    case "reputation":
      return copy.sort((a, b) => b.reputation_delta - a.reputation_delta);
    case "days_early":
      return copy.sort((a, b) => b.days_early - a.days_early);
    case "conviction":
      return copy.sort((a, b) => b.confidence - a.confidence);
    case "contested":
      return copy.sort((a, b) => b.contested_score - a.contested_score);
    case "isolation":
      return copy.sort((a, b) => b.isolation_score - a.isolation_score);
    case "timing_edge":
      return copy.sort(
        (a, b) =>
          b.days_early * b.verification_velocity - a.days_early * a.verification_velocity,
      );
    default:
      return copy.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }
}

export function buildVerificationSurface(calls: EnrichedVerifiedCall[]): VerificationSurfaceModule[] {
  if (!calls.length) return [];

  const byRep = [...calls].sort((a, b) => b.reputation_delta - a.reputation_delta);
  const byEarly = [...calls].sort((a, b) => b.days_early - a.days_early);
  const byIsolation = [...calls].sort((a, b) => b.isolation_score - a.isolation_score);
  const byVelocity = [...calls].sort((a, b) => b.verification_velocity - a.verification_velocity);
  const legendary = calls.filter((c) => c.receipt_strength === "legendary");
  const contrarian = calls.filter((c) => c.consensus_breaking || c.ignored_at_first);

  const largest = byRep[0];
  const timing = byEarly[0];
  const failure = contrarian.sort((a, b) => b.pressure_shift - a.pressure_shift)[0] ?? byIsolation[0];
  const fastest = byVelocity[0];
  const isolated = byIsolation[0];
  const resurfaced = legendary[0] ?? byRep[0];

  const streakAgent = buildAgentRanks(calls)[0];

  return [
    {
      id: "largest",
      label: "Largest verification today",
      headline: largest
        ? `${largest.agent_name} · +${largest.reputation_delta} rep`
        : "—",
      detail: largest?.market_title ?? "",
      tone: "amber",
      href: largest ? `/markets/${largest.market_slug}` : undefined,
    },
    {
      id: "timing",
      label: "Strongest timing edge",
      headline: timing ? `${timing.days_early}d before repricing` : "—",
      detail: timing ? `${timing.agent_name} on ${timing.market_title}` : "",
      tone: "emerald",
      href: timing ? `/agents/${timing.agent_slug}` : undefined,
    },
    {
      id: "failure",
      label: "Biggest consensus failure",
      headline: failure
        ? `${Math.round(failure.consensus_at_time)}% → ${Math.round(failure.final_consensus)}%`
        : "—",
      detail: failure?.market_title ?? "",
      tone: "violet",
      href: failure ? `/markets/${failure.market_slug}` : undefined,
    },
    {
      id: "fastest",
      label: "Fastest repricing",
      headline: fastest ? `${fastest.pressure_shift}pt in ${fastest.verification_delay_days}d` : "—",
      detail: fastest?.market_title ?? "",
      tone: "amber",
    },
    {
      id: "isolated",
      label: "Most isolated correct call",
      headline: isolated ? `${isolated.isolation_score}% isolation` : "—",
      detail: isolated ? `${isolated.agent_name} · ${isolated.days_early}d alone` : "",
      tone: "zinc",
      href: isolated ? `/agents/${isolated.agent_slug}` : undefined,
    },
    {
      id: "resurfaced",
      label: "Legendary resurfaced thesis",
      headline: resurfaced?.market_title.slice(0, 42) ?? "—",
      detail: resurfaced
        ? `${resurfaced.season_title} · ${resurfaced.season_role ?? "archived"}`
        : "",
      tone: "amber",
      href: resurfaced ? `/season?slug=${resurfaced.season_slug}` : undefined,
    },
    {
      id: "streak",
      label: "Longest verification streak",
      headline: streakAgent ? `${streakAgent.verified_count}-call streak` : "—",
      detail: streakAgent ? `${streakAgent.name} · public proof run` : "",
      tone: "zinc",
      href: streakAgent ? `/agents/${streakAgent.slug}` : undefined,
    },
    {
      id: "rep_gain",
      label: "Highest reputation gain",
      headline: largest ? `+${largest.reputation_delta} from verification` : "—",
      detail: largest?.reputation_impact.slice(0, 56) ?? "",
      tone: "emerald",
      href: "/reputation",
    },
  ];
}

export function buildHeroStats(calls: EnrichedVerifiedCall[], pulse = 0) {
  const legendary = calls.filter((c) => c.receipt_strength === "legendary").length;
  const avgEarly =
    calls.length > 0
      ? Math.round(calls.reduce((s, c) => s + c.days_early, 0) / calls.length)
      : 0;
  const ignored = calls.filter((c) => c.ignored_at_first).length;
  const avgIsolation =
    calls.length > 0
      ? Math.round(calls.reduce((s, c) => s + c.isolation_score, 0) / calls.length)
      : 0;

  return [
    {
      label: "Permanent receipts",
      value: String(calls.length + (pulse % 2)),
      sub: "in public archive",
      pulse: true,
    },
    {
      label: "Legendary proofs",
      value: String(legendary || Math.min(2, calls.length)),
      sub: "consensus-defying",
    },
    {
      label: "Avg timing edge",
      value: avgEarly ? `${avgEarly}d` : "—",
      sub: "before repricing",
    },
    {
      label: "Ignored at first",
      value: String(ignored),
      sub: "later vindicated",
    },
    {
      label: "Avg isolation",
      value: avgIsolation ? `${avgIsolation}%` : "—",
      sub: "at signal entry",
      highlight: true,
    },
  ];
}

export function buildProofInsights(calls: EnrichedVerifiedCall[]): VerifiedCallInsight[] {
  if (!calls.length) return [];

  const legendary = [...calls]
    .filter((c) => c.receipt_strength === "legendary")
    .sort((a, b) => b.days_early - a.days_early)[0];
  const earliest = [...calls].sort((a, b) => b.days_early - a.days_early)[0];
  const isolated = [...calls].sort((a, b) => b.isolation_score - a.isolation_score)[0];
  const ignored = [...calls].filter((c) => c.ignored_at_first).sort((a, b) => b.days_early - a.days_early)[0];
  const velocity = [...calls].sort((a, b) => b.verification_velocity - a.verification_velocity)[0];
  const season = calls.find((c) => c.season_role === "defining verification") ?? calls[0];

  return [
    {
      id: "legendary",
      label: "Defining verification",
      value: legendary?.market_title.slice(0, 28) ?? "—",
      sub: legendary ? `${legendary.agent_name} · ${legendary.days_early}d early` : "",
      tone: "amber",
      href: legendary ? `/markets/${legendary.market_slug}` : undefined,
    },
    {
      id: "earliest",
      label: "Strongest timing edge",
      value: earliest ? `${earliest.days_early}d` : "—",
      sub: earliest?.market_title ?? "",
      tone: "emerald",
      href: earliest ? `/markets/${earliest.market_slug}` : undefined,
    },
    {
      id: "isolated",
      label: "Most isolated",
      value: isolated ? `${isolated.isolation_score}%` : "—",
      sub: isolated?.agent_name ?? "",
      tone: "zinc",
    },
    {
      id: "ignored",
      label: "Ignored at first",
      value: ignored?.agent_name ?? "—",
      sub: ignored?.mock_label ?? "",
      tone: "violet",
      href: ignored ? `/agents/${ignored.agent_slug}` : undefined,
    },
    {
      id: "velocity",
      label: "Fastest repricing",
      value: velocity ? `${velocity.pressure_shift}pt` : "—",
      sub: velocity?.market_title ?? "",
      tone: "amber",
    },
    {
      id: "season",
      label: "Season memory",
      value: season?.season_title ?? "—",
      sub: season?.season_role ?? "",
      tone: "amber",
      href: season ? `/season?slug=${season.season_slug}` : "/season",
    },
  ];
}

export function buildVerificationChains(calls: EnrichedVerifiedCall[]): VerificationChain[] {
  const chainMap = new Map<string, EnrichedVerifiedCall[]>();
  for (const c of calls) {
    const id = c.chain_id ?? "chain-1";
    const list = chainMap.get(id) ?? [];
    list.push(c);
    chainMap.set(id, list);
  }

  return [...chainMap.entries()].slice(0, 4).map(([id, group]) => {
    const lead = group[0];
    const narrative = lead.linked_narratives[0] ?? lead.category;
    return {
      id,
      narrative,
      agents: [
        { name: lead.agent_name, slug: lead.agent_slug, role: "first signal" },
        ...lead.amplifiers.slice(0, 2).map((a) => ({ ...a, role: "amplified" })),
        { name: "Network consensus", slug: "", role: "migrated" },
      ],
      summary: `${group.length} linked receipts · ${lead.pressure_shift}pt consensus migration`,
      final_verification: lead.market_title,
      market_slug: lead.market_slug,
    };
  });
}

export function buildVerificationStreaks(calls: EnrichedVerifiedCall[]): VerificationStreak[] {
  const ranks = buildAgentRanks(calls);
  return ranks.slice(0, 6).map((a, i) => ({
    id: `streak-${a.slug}`,
    agent_name: a.name,
    agent_slug: a.slug,
    label:
      i === 0
        ? `${a.verified_count}-call macro streak`
        : i === 1
          ? `${2 + (i % 3)} straight early signals`
          : i === 2
            ? "Sports timing dominance"
            : `${a.verified_count} verified · ${calls.find((c) => c.agent_slug === a.slug)?.category ?? "Mixed"}`,
    count: a.verified_count,
    category: calls.find((c) => c.agent_slug === a.slug)?.category ?? "Mixed",
    legendary: i === 0,
    fragile: i >= 4,
  }));
}

export function buildBiggestReputationGains(calls: EnrichedVerifiedCall[], limit = 5) {
  return [...calls]
    .filter((c) => c.is_verified && c.reputation_delta > 0)
    .sort((a, b) => b.reputation_delta - a.reputation_delta)
    .slice(0, limit)
    .map((c) => ({
      id: c.id,
      agent_name: c.agent_name,
      agent_slug: c.agent_slug,
      avatar_color: c.avatar_color,
      market_title: c.market_title,
      market_slug: c.market_slug,
      reputation_delta: c.reputation_delta,
      consensus_breaking: c.consensus_breaking ?? false,
      tier_label: c.tier_label,
    }));
}

export function buildAgentRanks(calls: EnrichedVerifiedCall[]): AgentProofRank[] {
  const map = new Map<string, AgentProofRank>();
  for (const c of calls) {
    const cur = map.get(c.agent_slug) ?? {
      slug: c.agent_slug,
      name: c.agent_name,
      avatar_color: c.avatar_color,
      verified_count: 0,
      reputation_total: 0,
    };
    cur.verified_count += 1;
    cur.reputation_total += Math.max(0, c.reputation_delta);
    map.set(c.agent_slug, cur);
  }
  return [...map.values()].sort(
    (a, b) => b.verified_count - a.verified_count || b.reputation_total - a.reputation_total,
  );
}

export const TIMELINE_PHASE_LABELS: Record<
  import("./types").TimelinePhase,
  string
> = {
  thesis_opened: "Thesis opened",
  early_signal: "Early signal",
  mocked_ignored: "Mocked / ignored",
  pressure_builds: "Pressure builds",
  consensus_shifts: "Consensus shifts",
  market_reprices: "Market reprices",
  verified: "Verified",
  reputation_migrates: "Reputation migrates",
};
