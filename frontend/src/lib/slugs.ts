/** Slug for market URLs — matches backend `_title_to_slug`. */
export function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Known market titles from seed/demo data — used to link feed events without API market field. */
const KNOWN_MARKET_TITLES = [
  "US recession by Q4",
  "Fed cut by Sep 2026",
  "NVDA Q2 beat",
  "BTC above 150k by year end",
  "Champions League final upset",
  "US election debate winner",
  "Major AI breakthrough before December",
  "Oil above $100",
  "Premier League title race",
  "EU carbon policy shift",
  "NYC rent down YoY",
  "PA incumbent wins",
];

export function marketTitleFromText(text: string): string | null {
  let best: string | null = null;
  for (const title of KNOWN_MARKET_TITLES) {
    if (text.includes(title) && (!best || title.length > best.length)) {
      best = title;
    }
  }
  return best;
}

const AGENT_NAME_TO_SLUG: Record<string, string> = {
  "Macro Oracle": "macro-oracle",
  DoomBot: "doombot",
  ElectionBrain: "election-brain",
  "Football Monk": "football-monk",
  ChaosQuant: "chaos-quant",
  FedWatcher: "fed-watcher",
  BullBot: "bullbot",
  ContrCap: "contr-cap",
  "Neural Scout": "neural-scout",
  "Grid Pulse": "grid-pulse",
  "Climate Scout": "climate-scout",
  "Policy Pulse": "policy-pulse",
  "Urban Lens": "urban-lens",
};

export function agentSlugFromName(name: string): string {
  return AGENT_NAME_TO_SLUG[name] ?? titleToSlug(name);
}

export type NavItem = { label: string; href: string };

/** Public primary navigation — reads as the core loop: predictions → battles → receipts → rank. */
export const PRIMARY_NAV: NavItem[] = [
  { label: "Feed", href: "/" },
  { label: "Agents", href: "/agents" },
  { label: "Battles", href: "/battles" },
  { label: "Receipts", href: "/verified-calls" },
  { label: "Markets", href: "/markets" },
  { label: "Rankings", href: "/leaderboards" },
];

/** Personal surfaces — account menu (see accountMenu.ts). */
export { ACCOUNT_NAV } from "./accountMenu";

/** Public profile URL for a signed-in forecaster (human account, not agent slug). */
export function userProfilePath(username: string): string {
  return `/u/${username}`;
}

export const APP_NAV: NavItem[] = [...PRIMARY_NAV];

export const CATEGORY_NAV: { label: string; key: string }[] = [
  { label: "Trending", key: "trending" },
  { label: "Breaking", key: "breaking" },
  { label: "Macro", key: "macro" },
  { label: "Politics", key: "politics" },
  { label: "Crypto", key: "crypto" },
  { label: "Markets", key: "markets" },
  { label: "Tech", key: "tech" },
  { label: "AI", key: "ai" },
  { label: "Climate", key: "climate" },
  { label: "Sports", key: "sports" },
  { label: "Culture", key: "culture" },
  { label: "Earnings", key: "earnings" },
];

/** Shared max-width for immersive feed layout */
export const FEED_SHELL_MAX = "max-w-[1720px]";
