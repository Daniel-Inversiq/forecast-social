import type {
  AgentTake,
  CredibilitySplit,
  MarketDetail,
  WhyMarketMoving,
} from "./types";

function hash(s: string) {
  return s.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

export function enrichTakeWithReputationFallback(take: AgentTake): AgentTake {
  if (take.reputation_score != null) return take;
  const h = hash(take.slug);
  return {
    ...take,
    reputation_score: 52 + (h % 35),
    tier_key: h % 5 === 0 ? "proven" : h % 3 === 0 ? "trusted" : "emerging",
    tier_label: h % 5 === 0 ? "Proven" : h % 3 === 0 ? "Trusted" : "Emerging",
    timing_quality: 60 + (h % 28),
    calibration_score: 58 + (h % 26),
    verified_calls_count: 1 + (h % 8),
    reputation_live: false,
  };
}

export function buildFallbackCredibilitySplit(
  takes: AgentTake[],
  marketProb: number,
): CredibilitySplit {
  const enriched = takes.map(enrichTakeWithReputationFallback);
  const yes = enriched.filter((t) => t.side === "YES");
  const no = enriched.filter((t) => t.side === "NO");

  const sideStats = (sideTakes: AgentTake[]) => {
    if (!sideTakes.length) {
      return {
        total_reputation: 0,
        agent_count: 0,
        avg_timing_quality: 0,
        avg_calibration: 0,
        strongest_agent: null,
      };
    }
    const strongest = [...sideTakes].sort(
      (a, b) => (b.reputation_score ?? 0) - (a.reputation_score ?? 0),
    )[0];
    return {
      total_reputation: Math.round(
        sideTakes.reduce((s, t) => s + (t.reputation_score ?? 0), 0),
      ),
      agent_count: sideTakes.length,
      avg_timing_quality: Math.round(
        sideTakes.reduce((s, t) => s + (t.timing_quality ?? 0), 0) / sideTakes.length,
      ),
      avg_calibration: Math.round(
        sideTakes.reduce((s, t) => s + (t.calibration_score ?? 0), 0) / sideTakes.length,
      ),
      strongest_agent: {
        name: strongest.name,
        slug: strongest.slug,
        reputation_score: strongest.reputation_score ?? 0,
        tier_label: strongest.tier_label ?? "",
      },
    };
  };

  const yesStats = sideStats(yes);
  const noStats = sideStats(no);
  const contrarian = marketProb >= 55 ? noStats.total_reputation > yesStats.total_reputation * 0.9 : yesStats.total_reputation > noStats.total_reputation * 0.9;

  return {
    yes: yesStats,
    no: noStats,
    consensus_breaking: contrarian && (marketProb >= 62 || marketProb <= 38),
    consensus_break_count: contrarian ? 1 : 0,
    movement_type: contrarian ? "contrarian_led" : yesStats.total_reputation > noStats.total_reputation * 1.3 ? "consensus_led" : "mixed",
  };
}

export function buildFallbackWhyMoving(
  market: MarketDetail,
  takes: AgentTake[],
  credibility: CredibilitySplit,
): WhyMarketMoving {
  const first_movers = [...takes]
    .map(enrichTakeWithReputationFallback)
    .sort((a, b) => (b.reputation_score ?? 0) - (a.reputation_score ?? 0))
    .slice(0, 3)
    .map((t) => ({
      name: t.name,
      slug: t.slug,
      reputation_score: t.reputation_score ?? 50,
      tier_label: t.tier_label ?? "",
      event_type: "positioned",
    }));

  const p = Math.round(market.current_yes_probability);
  const repYes = credibility.yes.total_reputation;
  const repNo = credibility.no.total_reputation;
  const total = repYes + repNo || 1;

  let summary = market.why_moved;
  if (credibility.movement_type === "contrarian_led") {
    summary = `Contrarian-led move at ${p}% YES — high-reputation agents on NO carry ${Math.round((100 * repNo) / total)}% of thread credibility.`;
  } else if (credibility.movement_type === "consensus_led") {
    summary = `Consensus-led repricing at ${p}% YES — ${Math.round((100 * Math.max(repYes, repNo)) / total)}% reputation backs the dominant side.`;
  }

  return {
    headline: "Why this market is moving",
    summary,
    movement_type: credibility.movement_type,
    reputation_yes_share: Math.round((100 * repYes) / total),
    first_movers,
  };
}

export function resolveMarketCredibility(market: MarketDetail): {
  takes: AgentTake[];
  credibility: CredibilitySplit;
  why_moving: WhyMarketMoving;
} {
  const takes = market.agent_takes.map((t) =>
    t.reputation_score != null ? t : enrichTakeWithReputationFallback(t),
  );
  const credibility =
    market.credibility_split ??
    buildFallbackCredibilitySplit(takes, market.current_yes_probability);
  const why_moving =
    market.why_moving ??
    buildFallbackWhyMoving({ ...market, agent_takes: takes }, takes, credibility);
  return { takes, credibility, why_moving };
}
