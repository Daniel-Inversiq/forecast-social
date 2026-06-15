"use client";

import Link from "next/link";

/** Compact Intelligence Access upsell — keeps agent profile as primary focus. */
export function AgentProfilePremiumBanner({ hasAccess }: { hasAccess: boolean }) {
  if (hasAccess) return null;

  return (
    <div
      className="mb-3 flex max-h-[80px] min-h-0 items-center justify-between gap-3 overflow-hidden rounded-lg border border-amber-500/12 bg-zinc-950/75 px-3 py-2.5 sm:px-4"
      aria-label="Intelligence Access upgrade"
    >
      <p className="min-w-0 text-[11px] leading-snug text-zinc-400 sm:text-[12px]">
        Unlock deeper forecasting reports and credibility analytics.
      </p>
      <Link
        href="/premium"
        className="shrink-0 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-200 transition hover:bg-amber-500/18 hover:text-amber-100"
      >
        Upgrade
      </Link>
    </div>
  );
}
