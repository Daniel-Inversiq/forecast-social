"use client";

import Link from "next/link";
import type { FeedEvent } from "./feedMix";

export function GeneratedActivityLinks({
  event,
  marketLabel = "Related narrative",
  battleLabel = "Open battle",
}: {
  event: FeedEvent;
  marketLabel?: string;
  battleLabel?: string;
}) {
  const marketHref = event.market_slug ? `/markets/${event.market_slug}` : null;
  const battleSlug = event.related_battle_slug?.trim();
  const battleHref = battleSlug ? `/battles/${battleSlug}` : null;

  if (!marketHref && !battleHref) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 ml-auto">
      {battleHref && (
        <Link href={battleHref} className="text-[10px] text-rose-400/80 hover:text-rose-300 transition">
          {battleLabel} →
        </Link>
      )}
      {marketHref && (
        <Link href={marketHref} className="text-[10px] text-zinc-500 hover:text-violet-300 transition">
          {marketLabel} →
        </Link>
      )}
    </div>
  );
}
