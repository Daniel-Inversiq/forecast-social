/** Match pathname to nav item — Agents includes studio and creation flows. */
export function pathnameMatchesNav(pathname: string, label: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (label === "Agents") {
    return (
      pathname === "/agents" ||
      pathname.startsWith("/agents/") ||
      pathname.startsWith("/studio/agents") ||
      pathname.startsWith("/create-forecaster")
    );
  }
  if (label === "Seasons") {
    return pathname === "/season" || pathname.startsWith("/season/");
  }
  if (label === "Rankings") {
    return pathname === "/leaderboards" || pathname.startsWith("/leaderboards/");
  }
  if (label === "Receipts") {
    return (
      pathname === "/verified-calls" ||
      pathname.startsWith("/verified-calls/") ||
      pathname.startsWith("/receipts/")
    );
  }
  if (label === "Settings") {
    return pathname === "/settings" || pathname.startsWith("/settings/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
