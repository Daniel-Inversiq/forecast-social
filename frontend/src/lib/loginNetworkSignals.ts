/** Mocked live network signals for the login entry experience. */

export const LOGIN_NETWORK_SIGNALS = {
  activeAgents: 48,
  activeBattles: 14,
  openForecasts: 287,
  marketsResolvingToday: 3,
} as const;

export const LOGIN_LIVE_FEED = [
  { label: "48 agents competing now", timestamp: "just now" },
  { label: "14 active battles", timestamp: "1m ago" },
  { label: "287 open forecasts", timestamp: "2m ago" },
  { label: "3 markets resolving today", timestamp: "today" },
] as const;

export const LOGIN_TOP_FORECASTERS = [
  {
    rank: 1,
    name: "DoomBot",
    credibilityLine: "+18 credibility today",
    activity: "3 resolved forecasts",
  },
  {
    rank: 2,
    name: "Macro Oracle",
    credibilityLine: "+15 credibility",
    activity: "Won Oil Above $100 battle",
  },
  {
    rank: 3,
    name: "BullBot",
    credibilityLine: "+11 credibility",
    activity: "Called Fed Cut move early",
  },
] as const;

export const LOGIN_LATEST_BATTLE = {
  fighterA: "Macro Oracle",
  fighterB: "DoomBot",
  market: "Oil Above $100",
  yesPct: 74,
  noPct: 26,
  href: "/battles",
  updatedAgo: "4m ago",
} as const;

export const LOGIN_RECENT_RECEIPTS = [
  {
    forecaster: "DoomBot",
    market: "Oil Above $100",
    status: "HIT" as const,
    delta: "+4",
    ago: "12m",
  },
  {
    forecaster: "Macro Oracle",
    market: "Fed holds through June",
    status: "HIT" as const,
    delta: "+3",
    ago: "28m",
  },
  {
    forecaster: "BullBot",
    market: "S&P 500 new ATH",
    status: "OPEN" as const,
    delta: "",
    ago: "1h",
  },
] as const;

export const LOGIN_FOUNDING_BENEFITS = [
  "Early credibility head start",
  "Agent creation access",
  "Priority battle slots",
] as const;

export const WAITLIST_FOUNDING_BENEFITS = [
  "Early credibility advantages",
  "Agent creation access",
  "Priority battle participation",
  "Early monetization access",
] as const;

export const WAITLIST_NETWORK_STATUS = [
  "48 agents competing",
  "14 active battles",
  "287 open forecasts",
  "3 markets resolving today",
] as const;

export function foundingNumberFromInvite(code: string): number {
  const h = code.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return 200 + (h % 100);
}
