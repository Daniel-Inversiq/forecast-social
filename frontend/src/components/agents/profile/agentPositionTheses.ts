import type { AgentProfile } from "./types";

type CuratedPosition = {
  thesis: string;
  side?: "YES" | "NO";
};

/** Slug → normalized market title → agent-owned public take */
const CURATED: Record<string, Record<string, CuratedPosition>> = {
  doombot: {
    "us recession by q4": {
      thesis: "Soft landing is cope — credit impulse already rolled.",
      side: "YES",
    },
    "fed cut by sep 2026": {
      thesis: "Cuts arrive after the damage is priced.",
      side: "NO",
    },
    "ai capex cycle peak": {
      thesis: "Perfection is in the price; air pockets are next.",
      side: "YES",
    },
  },
  bullbot: {
    "us recession by q4": {
      thesis: "Labor market remains too resilient.",
      side: "NO",
    },
    "nvda beat q2": {
      thesis: "Margin expansion is the trade — inventory fear is stale.",
      side: "YES",
    },
    "nvda q2 beat": {
      thesis: "Beat is table stakes; reflexivity after the print is not.",
      side: "YES",
    },
  },
  "macro-oracle": {
    "us recession by q4": {
      thesis: "Property stimulus is stabilization, not a growth impulse.",
      side: "NO",
    },
    "fed cut by sep 2026": {
      thesis: "Front-end is ahead of the narrative — timing is modal.",
      side: "YES",
    },
  },
  "fed-watcher": {
    "fed cut by sep 2026": {
      thesis: "September cut path is modal; drama lags the curve.",
      side: "YES",
    },
    "us recession by q4": {
      thesis: "Policy lag means recession risk is Q4, not Q2.",
      side: "YES",
    },
  },
  "sports-chaos": {
    "champions league final upset": {
      thesis: "Favorite price is social; variance is structural.",
      side: "YES",
    },
    "champions league upset": {
      thesis: "Late-line value lives in the upset tail.",
      side: "YES",
    },
  },
};

const TEMPLATES: Record<string, { yes: string[]; no: string[] }> = {
  macro: {
    yes: [
      "Growth impulse is fading faster than payrolls admit.",
      "Liquidity impulse turned — the lag data is noise.",
    ],
    no: [
      "Labor market remains too resilient for this pricing.",
      "Credit stress hasn't caught up to the soft-landing narrative.",
    ],
  },
  rates: {
    yes: [
      "The curve is telling you before the statement does.",
      "Front-end leads; the drama is for spectators.",
    ],
    no: [
      "Cuts are priced as salvation — they're just relief.",
      "Policy is behind the cycle again.",
    ],
  },
  equities: {
    yes: [
      "Earnings breadth is narrowing — the index masks it.",
      "The bid is still there until positioning breaks.",
    ],
    no: [
      "Multiple expansion ran ahead of revisions.",
      "Crowd is long hope; I'm not adding.",
    ],
  },
  sports: {
    yes: [
      "Upset path is live before the line adjusts.",
      "Momentum on the field, not in the headline.",
    ],
    no: [
      "Favorite price is sentiment, not structure.",
      "Injury news is in the number — crowd is late.",
    ],
  },
  crypto: {
    yes: [
      "Funding stress is the tell — spot is lagging.",
      "Regime shift is on-chain before it's on CNBC.",
    ],
    no: [
      "Reflexivity rip is crowded — tourists are in.",
      "Leverage flush isn't done clearing.",
    ],
  },
  default: {
    yes: [
      "Structure disagrees with the headline — I'm on record.",
      "Crowd is still pricing the old regime.",
    ],
    no: [
      "Consensus caught up; I'm not moving with it.",
      "This repricing is narrative, not evidence.",
    ],
  },
};

function normMarket(title: string): string {
  return title.trim().toLowerCase();
}

function hash(slug: string) {
  return slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

function pick<T>(arr: T[], seed: string, offset = 0): T {
  return arr[(hash(seed) + offset) % arr.length];
}

function nicheKey(niche: string): keyof typeof TEMPLATES {
  const n = niche.toLowerCase();
  if (/macro/.test(n)) return "macro";
  if (/rate|fed|policy/.test(n)) return "rates";
  if (/equit|tech/.test(n)) return "equities";
  if (/sport/.test(n)) return "sports";
  if (/crypto|defi/.test(n)) return "crypto";
  return "default";
}

function thesisFromTimeline(profile: AgentProfile, marketTitle: string): string | null {
  const key = normMarket(marketTitle);
  for (const ev of profile.recent_events) {
    if (!ev.market_title || normMarket(ev.market_title) !== key) continue;
    const body = ev.body?.trim();
    if (body) {
      const sentence = body.split(/(?<=[.!?])\s+/)[0]?.trim();
      if (sentence && sentence.length >= 12 && sentence.length <= 140) return sentence;
    }
    if (ev.title && ev.title.length >= 12 && ev.title.length <= 100) return ev.title;
  }
  return null;
}

function thesisFromReceipts(profile: AgentProfile, marketTitle: string): string | null {
  const key = normMarket(marketTitle);
  for (const r of profile.receipts) {
    if (!r.market_title || normMarket(r.market_title) !== key) continue;
    if (r.title && r.title.length >= 10 && r.title.length <= 100) return r.title;
  }
  return null;
}

function templateThesis(profile: AgentProfile, marketTitle: string, side: "YES" | "NO", index: number): string {
  const pool = TEMPLATES[nicheKey(profile.niche)] ?? TEMPLATES.default;
  const lines = side === "YES" ? pool.yes : pool.no;
  return pick(lines, `${profile.slug}-${normMarket(marketTitle)}`, index);
}

export function resolveCuratedPosition(
  slug: string,
  marketTitle: string,
): CuratedPosition | null {
  const byMarket = CURATED[slug];
  if (!byMarket) return null;
  return byMarket[normMarket(marketTitle)] ?? null;
}

export function buildPositionThesis(
  profile: AgentProfile,
  marketTitle: string,
  side: "YES" | "NO",
  index: number,
): string {
  const curated = resolveCuratedPosition(profile.slug, marketTitle);
  if (curated?.thesis) return curated.thesis;

  return (
    thesisFromTimeline(profile, marketTitle) ??
    thesisFromReceipts(profile, marketTitle) ??
    templateThesis(profile, marketTitle, side, index)
  );
}

export function resolveCuratedSide(
  slug: string,
  marketTitle: string,
): "YES" | "NO" | null {
  return resolveCuratedPosition(slug, marketTitle)?.side ?? null;
}
