/** Scan-friendly forecast thesis — one sentence, ~15–20 words. */

export const MAX_THESIS_WORDS = 20;
export const TARGET_THESIS_WORDS = 18;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function clampThesisWords(text: string, maxWords = MAX_THESIS_WORDS): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  const clipped = words.slice(0, maxWords).join(" ");
  return clipped.endsWith(".") ? clipped : `${clipped}.`;
}

function hashPick(seed: string, options: string[]): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return options[Math.abs(h) % options.length]!;
}

type ThesisTemplate = {
  match: RegExp;
  yes: string[];
  no: string[];
  neutral?: string[];
};

const MARKET_TEMPLATES: ThesisTemplate[] = [
  {
    match: /ai|breakthrough|nvda|capability|frontier|lab/i,
    yes: [
      "Lab cadence and capex cycle suggest breakthrough odds remain underpriced.",
      "Compute buildout and benchmark leaks keep upside alive before December.",
    ],
    no: [
      "Scaling costs and delayed public benchmarks make a near-term breakthrough unlikely.",
    ],
  },
  {
    match: /btc|bitcoin|crypto|150k|etf/i,
    yes: [
      "ETF flows and liquidity expansion continue to overpower bearish positioning.",
      "Spot inflows and halving supply still outrun models on year-end targets.",
    ],
    no: [
      "Liquidity drains and crowded longs raise odds momentum fades before 150k.",
    ],
  },
  {
    match: /fed.*cut|rate.*cut|sep|september|fomc|cuts/i,
    yes: [
      "Cooling inflation and weakening labor data increase pressure for an earlier cut.",
      "Softening prints let the Fed ease without fully losing credibility.",
    ],
    no: [
      "Sticky services inflation keeps the Fed on hold longer than futures imply.",
    ],
  },
  {
    match: /recession|q4|gdp|labor|unemployment/i,
    yes: [
      "Leading indicators and credit stress still point to a late-cycle downturn.",
      "Labor cracks and profit warnings are repricing recession risk higher.",
    ],
    no: [
      "Consumer balance sheets and easing financial conditions delay recession calls.",
    ],
  },
  {
    match: /nvda|beat|earnings|margin/i,
    yes: [
      "Margin expansion and AI demand keep beat odds ahead of consensus.",
      "Supply chain relief plus hyperscaler orders support another upside print.",
    ],
    no: [
      "Inventory builds and China demand risk cap upside on the next report.",
    ],
  },
  {
    match: /election|incumbent|politic|debate|senate/i,
    yes: [
      "Polling error and turnout models still underprice the incumbent path.",
      "Fundraising velocity and state polls lean toward holding the seat.",
    ],
    no: [
      "Undecided drift and economic headwinds favor the challenger coalition.",
    ],
  },
  {
    match: /rent|housing|nyc|mortgage/i,
    yes: [
      "New lease prints and supply coming online push rents lower year over year.",
      "Softening demand in gateway cities makes a YoY decline plausible.",
    ],
    no: [
      "Tight inventory and sticky wages keep rents from breaking lower.",
    ],
  },
  {
    match: /champion|sports|upset|final|league/i,
    yes: [
      "Upset paths stay live as the favorite prices in a clean win.",
      "Injury noise and tactical variance keep long-shot odds too low.",
    ],
    no: [
      "Talent gap and depth charts favor the favorite holding through 90 minutes.",
    ],
  },
  {
    match: /carbon|climate|eu|policy/i,
    yes: [
      "Lobby pressure and draft leaks moved implementation timelines up.",
      "Industrial buy-in makes a faster policy rollout the base case.",
    ],
    no: [
      "Coalition friction and cost blowouts delay the announced policy shift.",
    ],
  },
];

function leanSide(probability: number | null | undefined): "YES" | "NO" | "neutral" {
  if (probability == null || !Number.isFinite(probability)) return "neutral";
  if (probability >= 55) return "YES";
  if (probability <= 45) return "NO";
  return "neutral";
}

export function generateMarketThesis(
  title: string,
  opts?: {
    probability?: number | null;
    category?: string;
    narrative?: string;
    seed?: string;
  },
): string {
  const seed = opts?.seed ?? title;
  const side = leanSide(opts?.probability);
  const haystack = `${title} ${opts?.category ?? ""} ${opts?.narrative ?? ""}`;

  for (const tpl of MARKET_TEMPLATES) {
    if (!tpl.match.test(haystack)) continue;
    const pool =
      side === "YES" ? tpl.yes : side === "NO" ? tpl.no : tpl.neutral ?? [...tpl.yes, ...tpl.no];
    return clampThesisWords(hashPick(seed, pool));
  }

  const p = opts?.probability != null ? Math.round(opts.probability) : null;
  const fallback =
    side === "YES"
      ? [
          p != null
            ? `Desk conviction at ${p}% YES — flows and positioning still lean risk-on.`
            : "Positioning and flows still lean risk-on versus consensus.",
          "Leading agents see upside as the crowd prices caution.",
        ]
      : side === "NO"
        ? [
            p != null
              ? `At ${p}% YES the crowd is optimistic — dissenters see downside catalysts.`
              : "Dissenting desks see catalysts the consensus is underweighting.",
            "Risk skew favors NO as macro headwinds stack up.",
          ]
        : [
            "Agents split on timing — conviction is there, direction is not.",
            "Network is deadlocked until the next hard data print.",
          ];

  return clampThesisWords(hashPick(seed, fallback));
}

export type ForecastThesisInput = {
  thesis?: string | null;
  title?: string;
  marketOrNarrative?: string | null;
  marketTitle?: string | null;
  body?: string | null;
  summary?: string | null;
  priorThesis?: string | null;
  side?: "YES" | "NO" | null;
  probability?: number | null;
  category?: string;
  narrative?: string;
  seed?: string;
};

/** Pick the best available reasoning and clamp to scan length. */
export function resolveForecastThesis(input: ForecastThesisInput): string {
  const seed = input.seed ?? input.title ?? input.marketOrNarrative ?? "forecast";
  const candidates = [
    input.thesis,
    input.priorThesis,
    input.summary,
    input.body,
  ].filter((c): c is string => typeof c === "string" && c.trim().length > 8);

  for (const raw of candidates) {
    const cleaned = raw.replace(/\s+/g, " ").trim();
    if (countWords(cleaned) <= MAX_THESIS_WORDS && cleaned.length >= 24) {
      return cleaned.endsWith(".") ? cleaned : `${cleaned}.`;
    }
    if (countWords(cleaned) > MAX_THESIS_WORDS) {
      const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0]?.trim() ?? cleaned;
      if (firstSentence && countWords(firstSentence) <= MAX_THESIS_WORDS) {
        return firstSentence.endsWith(".") ? firstSentence : `${firstSentence}.`;
      }
      return clampThesisWords(cleaned);
    }
  }

  const marketLabel =
    input.marketOrNarrative?.trim() ||
    input.marketTitle?.trim() ||
    input.title?.trim() ||
    "this market";

  return generateMarketThesis(marketLabel, {
    probability: input.probability,
    category: input.category,
    narrative: input.narrative,
    seed,
  });
}

export function resolveFeedEventThesis(event: {
  title: string;
  body?: string;
  probability?: number | null;
  market_title?: string | null;
  prior_thesis?: string | null;
  stance_side?: string | null;
  reasoning?: { summary?: string } | null;
  agent?: { niche?: string };
}): string {
  const lean = leanSide(event.probability);
  const side =
    event.stance_side === "YES" || event.stance_side === "NO"
      ? event.stance_side
      : lean === "neutral"
        ? undefined
        : lean;

  return resolveForecastThesis({
    thesis: event.prior_thesis,
    summary: event.reasoning?.summary,
    body: event.body,
    title: event.title,
    marketTitle: event.market_title,
    probability: event.probability,
    category: event.agent?.niche,
    side,
    seed: `${event.title}-${event.agent?.niche ?? ""}`,
  });
}
