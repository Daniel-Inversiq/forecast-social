import type { EnrichedAgentProfile } from "@/components/agents/profile/types";
import type { PositionsPayload } from "@/components/positions/types";

const CANONICAL_TAGS = new Set([
  "Macro",
  "Crypto",
  "AI",
  "Sports",
  "Politics",
  "Rates",
  "Markets",
  "Equities",
  "Climate",
]);

const KEYWORD_TAGS: { tag: string; pattern: RegExp }[] = [
  { tag: "Macro", pattern: /macro|fed\b|fomc|liquidity|inflation|gdp|treasury|yield|ecb|central bank|policy rate/i },
  { tag: "Rates", pattern: /\brates\b|bond|duration|curve/i },
  { tag: "Crypto", pattern: /crypto|bitcoin|btc|eth|ethereum|solana|defi|token/i },
  { tag: "AI", pattern: /\bai\b|artificial intelligence|openai|nvidia|gpu|chip|model training/i },
  { tag: "Sports", pattern: /sport|nba|nfl|mlb|soccer|championship|playoff|super bowl/i },
  { tag: "Politics", pattern: /politic|election|congress|senate|president|ballot|white house/i },
  { tag: "Equities", pattern: /equity|equities|stock|s&p|nasdaq|earnings|ipo/i },
  { tag: "Climate", pattern: /climate|carbon|emission|renewable|energy transition/i },
  { tag: "Markets", pattern: /market|trading|volatility|commodit/i },
];

function canonicalizeTag(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const direct = trimmed
    .split(/[\s·/&]+/)[0]
    .replace(/^[^a-zA-Z]+|[^a-zA-Z0-9+]+$/g, "");
  if (!direct) return null;

  const title =
    direct.toLowerCase() === "ai"
      ? "AI"
      : direct.charAt(0).toUpperCase() + direct.slice(1).toLowerCase();

  if (CANONICAL_TAGS.has(title)) return title;

  for (const { tag, pattern } of KEYWORD_TAGS) {
    if (pattern.test(trimmed)) return tag;
  }

  return null;
}

function addTag(counts: Map<string, number>, raw: string | null | undefined, weight = 1) {
  if (!raw) return;
  const tag = canonicalizeTag(raw);
  if (!tag) return;
  counts.set(tag, (counts.get(tag) ?? 0) + weight);
}

function addFromText(counts: Map<string, number>, text: string | null | undefined, weight = 1) {
  if (!text) return;
  addTag(counts, text, weight);
  for (const { tag, pattern } of KEYWORD_TAGS) {
    if (pattern.test(text)) {
      counts.set(tag, (counts.get(tag) ?? 0) + weight);
    }
  }
}

/**
 * Derive social focus-area tags from participation history (no analytics).
 */
export function deriveProfileFocusAreas(
  profile: EnrichedAgentProfile,
  positions?: PositionsPayload | null,
): string[] {
  const counts = new Map<string, number>();

  for (const pos of profile.positions) {
    addFromText(counts, pos.market, 2);
  }

  for (const market of profile.top_markets) {
    addTag(counts, market.category, 2);
    addFromText(counts, market.title, 1);
  }

  for (const receipt of profile.receipts) {
    addFromText(counts, receipt.market_title, 2);
    addFromText(counts, receipt.title, 1);
  }

  for (const receipt of profile.enriched_receipts) {
    addFromText(counts, receipt.market_title, 2);
    addFromText(counts, receipt.title, 1);
  }

  for (const signal of profile.signals) {
    addFromText(counts, signal.market, 2);
    addFromText(counts, signal.headline, 1);
  }

  for (const battle of profile.battles) {
    addFromText(counts, battle.market, 2);
  }

  if (positions) {
    for (const pos of positions.active_positions) {
      addFromText(counts, pos.market_title, 2);
    }
    for (const pos of positions.resolved_positions) {
      addFromText(counts, pos.market_title, 2);
    }
  }

  addFromText(counts, profile.niche, 2);
  for (const tag of profile.category_tags) {
    addTag(counts, tag, 3);
  }

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);

  if (ranked.length > 0) return ranked.slice(0, 6);

  if (profile.category_tags.length > 0) {
    return profile.category_tags
      .map((t) => canonicalizeTag(t))
      .filter((t): t is string => Boolean(t))
      .slice(0, 4);
  }

  const fromNiche = canonicalizeTag(profile.niche);
  return fromNiche ? [fromNiche] : [];
}
