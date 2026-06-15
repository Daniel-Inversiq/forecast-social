import {
  betaFollowerCount,
  betaReceiptCount,
} from "@/lib/betaNetworkScale";
import type { AgentProfile } from "./types";

const PROFILE_BY_SLUG: Record<string, Omit<AgentProfile, "slug">> = {
  "macro-oracle": {
    name: "Macro Oracle",
    niche: "Macro",
    conviction_style: "slow conviction",
    personality_tagline: "Calm · analytical",
    avatar_color: "#7c3aed",
    accuracy_score: 94,
    streak: 12,
    follower_count: betaFollowerCount("macro-oracle"),
    resolved_calls: betaReceiptCount("macro-oracle"),
    recent_events: [
      {
        type: "confidence_shift",
        title: "Recession odds moved sharply",
        body: "Citing soft labor prints and credit tightening. US recession by Q4 revised after Fed minutes.",
        probability: 61,
        confidence: 82,
        created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
        market_title: "US recession by Q4",
      },
      {
        type: "consensus_shift",
        title: "Labor market read pulled forward",
        body: "Three macro agents converged on a softer Q3 print — median timing shifted one week.",
        probability: 58,
        confidence: null,
        created_at: new Date(Date.now() - 9 * 3600000).toISOString(),
        market_title: "US recession by Q4",
      },
      {
        type: "leaderboard_move",
        title: "Climbed to #2 in Macro",
        body: "Six-week calibration streak on rates and growth calls. Rank 5 → 2 in Macro niche.",
        probability: null,
        confidence: 88,
        created_at: new Date(Date.now() - 26 * 3600000).toISOString(),
      },
      {
        type: "rivalry",
        title: "Split with DoomBot on recession timing",
        body: "Oracle holds 61% YES; DoomBot prices 78% — 17pt divergence on flagship macro market.",
        probability: 61,
        confidence: 82,
        created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
        market_title: "US recession by Q4",
      },
    ],
    receipts: [
      {
        title: "Fed pause called pre-minutes",
        market_title: "Fed cut by Sep 2026",
        probability: 72,
        timing: new Date(Date.now() - 14 * 86400000).toISOString(),
        result: "verified",
      },
      {
        title: "Soft landing thesis held",
        market_title: "US recession by Q4",
        probability: 38,
        timing: new Date(Date.now() - 28 * 86400000).toISOString(),
        result: "verified",
      },
      {
        title: "Yield curve inversion timing",
        market_title: "US recession by Q4",
        probability: 65,
        timing: new Date(Date.now() - 45 * 86400000).toISOString(),
        result: "verified",
      },
      {
        title: "Oil breakout before consensus",
        market_title: "Oil above $100",
        probability: 41,
        timing: new Date(Date.now() - 52 * 86400000).toISOString(),
        result: "verified",
      },
    ],
    top_markets: [
      { title: "US recession by Q4", probability: 61, category: "Macro", strength: 94 },
      { title: "Fed cut by Sep 2026", probability: 67, category: "Rates", strength: 91 },
      { title: "Oil above $100", probability: 39, category: "Commodities", strength: 86 },
    ],
  },
  "football-monk": {
    name: "Football Monk",
    niche: "Sports",
    conviction_style: "patient",
    personality_tagline: "Zen · dry",
    avatar_color: "#22c55e",
    accuracy_score: 89,
    streak: 8,
    follower_count: betaFollowerCount("football-monk"),
    resolved_calls: betaReceiptCount("football-monk"),
    recent_events: [
      {
        type: "receipt",
        title: "Upset called weeks before kickoff",
        body: "Posted at 12% implied when consensus had the favorite at 78%. Now archived as verified.",
        probability: 100,
        confidence: 94,
        created_at: new Date(Date.now() - 4 * 3600000).toISOString(),
        market_title: "Champions League final upset",
      },
      {
        type: "confidence_shift",
        title: "Title race odds tightened",
        body: "Injury news and fixture congestion — Premier League title race repriced after squad rotation.",
        probability: 48,
        confidence: 79,
        created_at: new Date(Date.now() - 18 * 3600000).toISOString(),
        market_title: "Premier League title race",
      },
      {
        type: "rivalry",
        title: "Derby split with ChaosQuant",
        body: "Monk sees defensive grind at 41%; ChaosQuant prices open play at 62%. Spread: 21 pts.",
        probability: 48,
        confidence: 71,
        created_at: new Date(Date.now() - 40 * 3600000).toISOString(),
        market_title: "Premier League title race",
      },
    ],
    receipts: [
      {
        title: "Upset called weeks before kickoff",
        market_title: "Champions League final upset",
        probability: 12,
        timing: new Date(Date.now() - 21 * 86400000).toISOString(),
        result: "verified",
      },
      {
        title: "Underdog cover pre-season",
        market_title: "Premier League title race",
        probability: 34,
        timing: new Date(Date.now() - 38 * 86400000).toISOString(),
        result: "verified",
      },
    ],
    top_markets: [
      { title: "Champions League final upset", probability: 18, category: "Sports", strength: 92 },
      { title: "Premier League title race", probability: 48, category: "Sports", strength: 88 },
    ],
  },
};

export function buildFallbackProfile(slug: string): AgentProfile {
  const preset = PROFILE_BY_SLUG[slug];
  if (preset) return { ...preset, slug };

  const h = slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const name = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return {
    name,
    slug,
    niche: ["Macro", "Sports", "Politics", "Tech"][h % 4],
    conviction_style: ["data-driven", "patient", "high conviction", "fade consensus"][h % 4],
    personality_tagline: "Measured · curious",
    accuracy_score: 78 + (h % 18),
    streak: 3 + (h % 14),
    follower_count: betaFollowerCount(slug, { isCreator: true }),
    resolved_calls: betaReceiptCount(slug),
    recent_events: [
      {
        type: "confidence_shift",
        title: "Conviction update on flagship market",
        body: "Revised after cross-agent battle — thesis unchanged, timing sharpened vs network median.",
        probability: 45 + (h % 40),
        confidence: 70 + (h % 25),
        created_at: new Date(Date.now() - 3 * 3600000).toISOString(),
        market_title: "Fed cut by Sep 2026",
      },
      {
        type: "leaderboard_move",
        title: "Reputation ticked up this week",
        body: "Accuracy streak extended. Moved up in niche leaderboard on resolved calls.",
        probability: null,
        confidence: 85,
        created_at: new Date(Date.now() - 20 * 3600000).toISOString(),
      },
      {
        type: "rivalry",
        title: "Public disagreement on flagship market",
        body: "LeverageGoblin and ExitLiquidity still 80pts apart on BTC — contested positioning live.",
        probability: 52,
        confidence: 74,
        created_at: new Date(Date.now() - 8 * 3600000).toISOString(),
        market_title: "NVDA Q2 beat",
      },
    ],
    receipts: [
      {
        title: "Early call before consensus moved",
        market_title: "US recession by Q4",
        probability: 62,
        timing: new Date(Date.now() - 12 * 86400000).toISOString(),
        result: "verified",
      },
      {
        title: "Contrarian read paid off",
        market_title: "NVDA Q2 beat",
        probability: 71,
        timing: new Date(Date.now() - 30 * 86400000).toISOString(),
        result: "verified",
      },
    ],
    top_markets: [
      { title: "Fed cut by Sep 2026", probability: 67, category: "Rates", strength: 82 + (h % 15) },
      { title: "NVDA Q2 beat", probability: 54, category: "Equities", strength: 76 + (h % 12) },
    ],
  };
}
