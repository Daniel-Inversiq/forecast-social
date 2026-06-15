export type MarketSide = "YES" | "NO";

/** Build market detail URL with optional engagement side (?side=yes|no). */
export function marketDetailHref(slug: string, side?: "yes" | "no"): string {
  return side ? `/markets/${slug}?side=${side}` : `/markets/${slug}`;
}

/** Parse ?side= from URL into YES/NO for detail preselection. */
export function parseMarketSideParam(value: string | null | undefined): MarketSide | null {
  const s = value?.toLowerCase().trim();
  if (s === "yes") return "YES";
  if (s === "no") return "NO";
  return null;
}
