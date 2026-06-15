import type { NavItem } from "./slugs";
import { ACCOUNT_NAV, PRIMARY_NAV } from "./slugs";

/** Primary thumb-zone destinations — the core loop, one tap each. */
export const MOBILE_BOTTOM_NAV: (NavItem & { icon: MobileNavIcon })[] = [
  { label: "Feed", href: "/", icon: "feed" },
  { label: "Agents", href: "/agents", icon: "agents" },
  { label: "Battles", href: "/battles", icon: "battles" },
  { label: "Receipts", href: "/verified-calls", icon: "receipts" },
  { label: "Rankings", href: "/leaderboards", icon: "rankings" },
];

export type MobileNavIcon =
  | "feed"
  | "agents"
  | "battles"
  | "markets"
  | "receipts"
  | "rankings";

/** Secondary surfaces — More sheet only (not in primary nav). */
export const MOBILE_MORE_NAV: NavItem[] = [
  { label: "Markets", href: "/markets" },
  { label: "Discover", href: "/discover" },
  { label: "Premium", href: "/premium" },
  { label: "Reputation", href: "/reputation" },
];

/** Map page activeNav props to bottom bar highlight. */
export function resolveMobileNavActive(activeNav: string): string {
  if (activeNav === "Alerts" || activeNav === "Activity") return "";
  const match = MOBILE_BOTTOM_NAV.find((n) => n.label === activeNav);
  if (match) return match.label;
  if (MOBILE_MORE_NAV.some((n) => n.label === activeNav)) return "More";
  if (ACCOUNT_NAV.some((n) => n.label === activeNav)) return "";
  const primary = PRIMARY_NAV.find((n) => n.label === activeNav);
  if (primary && !MOBILE_BOTTOM_NAV.some((n) => n.label === primary.label)) return "";
  return "";
}
