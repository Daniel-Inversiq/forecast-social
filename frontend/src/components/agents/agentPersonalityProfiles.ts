import type { ForecasterBase } from "./types";

export type AgentPersonalityProfile = {
  niche_badge: string;
  personality_quote: string;
  recent_take: string;
  style_badges?: string[];
};

/** Curated creator voice for Season 1 core cast and known slugs. */
const CURATED: Record<string, AgentPersonalityProfile> = {
  doombot: {
    niche_badge: "Macro · Contrarian",
    personality_quote: "Consensus is usually late.",
    recent_take:
      "AI capex euphoria is peaking. Markets are pricing perfection.",
    style_badges: ["Macro", "Contrarian", "High Conviction"],
  },
  "macro-oracle": {
    niche_badge: "Macro · Systematic",
    personality_quote: "Data over narratives.",
    recent_take:
      "Property stimulus is not growth. It's stabilization.",
    style_badges: ["Macro", "Systematic"],
  },
  "sports-chaos": {
    niche_badge: "Sports · High Conviction",
    personality_quote: "Momentum beats sentiment.",
    recent_take:
      "Champions League upset probability is massively underpriced.",
    style_badges: ["Sports", "Momentum", "High Conviction"],
  },
  bullbot: {
    niche_badge: "Equities · Momentum",
    personality_quote: "The dip is still there.",
    recent_take:
      "NVDA beat is consensus — the reflexivity rip after is not.",
    style_badges: ["Equities", "Momentum"],
  },
  "fed-watcher": {
    niche_badge: "Rates · Policy-First",
    personality_quote: "The curve is the signal.",
    recent_take:
      "September cut path is modal. Front-end leads, drama lags.",
    style_badges: ["Rates", "Macro", "Policy-First"],
  },
};

const RECENT_TAKE_POOL = [
  "Crowd is still pricing the old regime — I'm not moving.",
  "This repricing is narrative, not structure. Fade the headline.",
  "Late information just hit — the line hasn't caught up.",
  "Consensus caught up; rotating before the overcorrection.",
  "Spread widened again. Someone is wrong and it's not me.",
  "Timing edge is live — holding through the squeeze attempt.",
];

const QUOTE_BY_STYLE: Record<string, string> = {
  contrarian: "Crowded trades die loud.",
  fade: "Consensus is usually late.",
  macro: "Regime beats narrative.",
  policy: "The curve is the signal.",
  momentum: "Price leads story.",
  chaos: "Chaos is the edge.",
  analytical: "Data over narratives.",
  bearish: "Fragility compounds.",
  bullish: "The dip is still there.",
};

function hash(slug: string) {
  return slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

function pick<T>(arr: T[], seed: string, offset = 0): T {
  return arr[(hash(seed) + offset) % arr.length];
}

function badgeSuffix(agent: ForecasterBase): string {
  const style = `${agent.conviction_style} ${agent.personality_tagline}`.toLowerCase();
  if (/contrarian|fade|skeptic/.test(style)) return "Contrarian";
  if (/high conviction|momentum|volatile|chaos|hot-take/.test(style)) return "High Conviction";
  if (/policy|hawk|precise|terminal/.test(style)) return "Policy-First";
  if (/slow|patient|calm|analytical|data|evidence/.test(style)) return "Systematic";
  if (/bearish|blunt|doom/.test(style)) return "Contrarian";
  if (/optimistic|bull|punchy/.test(style)) return "Momentum";
  return agent.conviction_style.split(" ")[0]
    ? agent.conviction_style.charAt(0).toUpperCase() + agent.conviction_style.slice(1)
    : "Conviction";
}

function inferQuote(agent: ForecasterBase): string {
  const style = `${agent.conviction_style} ${agent.personality_tagline}`.toLowerCase();
  for (const [key, quote] of Object.entries(QUOTE_BY_STYLE)) {
    if (style.includes(key)) return quote;
  }
  const tagline = agent.personality_tagline.split("·").map((p) => p.trim());
  if (tagline.length >= 2) {
    const tone = tagline[1];
    return `${tone.charAt(0).toUpperCase()}${tone.slice(1)} over noise.`;
  }
  return pick(Object.values(QUOTE_BY_STYLE), agent.slug, 1);
}

function buildRecentTake(agent: ForecasterBase): string {
  const h = hash(agent.slug);
  const niche = agent.niche.toLowerCase();
  if (niche === "macro" || niche === "rates") {
    const takes = [
      "Soft landing is still overpriced — credit impulse disagrees.",
      "Cut timing repriced; structure didn't change.",
      "Liquidity impulse fading while labor softens.",
    ];
    return pick(takes, agent.slug, 2);
  }
  if (niche === "sports") {
    const takes = [
      "Late scratch just moved the upset path — crowd is asleep.",
      "Injury cluster live before the line adjusts.",
      "Favorite price is social; variance is structural.",
    ];
    return pick(takes, agent.slug, 3);
  }
  if (niche === "tech") {
    const takes = [
      "Capex cycle peaked — narrative still bidding the rip.",
      "Hardware shortage easing is priced wrong on the tail.",
    ];
    return pick(takes, agent.slug, 4);
  }
  return pick(RECENT_TAKE_POOL, agent.slug, h % RECENT_TAKE_POOL.length);
}

function badgesFromNicheBadge(niche_badge: string, niche: string): string[] {
  const parts = niche_badge
    .split("·")
    .map((p) => p.trim())
    .filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (label: string) => {
    const key = label.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(label);
    }
  };
  push(niche);
  for (const p of parts) push(p);
  return out.slice(0, 4);
}

function inferStyleBadges(agent: ForecasterBase, niche_badge: string): string[] {
  const badges = badgesFromNicheBadge(niche_badge, agent.niche);
  const style = `${agent.conviction_style} ${agent.personality_tagline}`.toLowerCase();
  if (/systematic|analytical|data|model|evidence/.test(style) && !badges.some((b) => /systematic/i.test(b))) {
    badges.push("Systematic");
  }
  if (/contrarian|fade|skeptic|bear/.test(style) && !badges.some((b) => /contrarian/i.test(b))) {
    badges.push("Contrarian");
  }
  if (/momentum|volatile|chaos|hot-take|bullish|optimistic/.test(style) && !badges.some((b) => /momentum/i.test(b))) {
    badges.push("Momentum");
  }
  if (/high conviction/.test(style) && !badges.some((b) => /high conviction/i.test(b))) {
    badges.push("High Conviction");
  }
  return badges.slice(0, 4);
}

export function resolveStyleBadges(agent: ForecasterBase): string[] {
  const personality = resolveAgentPersonality(agent);
  return personality.style_badges ?? inferStyleBadges(agent, personality.niche_badge);
}

export function resolveAgentPersonality(agent: ForecasterBase): AgentPersonalityProfile {
  const curated = CURATED[agent.slug];
  if (curated) return curated;

  const niche_badge = `${agent.niche} · ${badgeSuffix(agent)}`;
  return {
    niche_badge,
    personality_quote: inferQuote(agent),
    recent_take: buildRecentTake(agent),
    style_badges: inferStyleBadges(agent, niche_badge),
  };
}
