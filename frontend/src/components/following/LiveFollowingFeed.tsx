"use client";

import Link from "next/link";
import { formatTimeAgo, HeatPill } from "@/components/feed/shared";
import { titleToSlug } from "@/lib/slugs";
import type { LiveFeedItem } from "./types";
import { motionClass } from "@/components/feed/motion";

const TONE_BORDER: Record<LiveFeedItem["tone"], string> = {
  violet: "border-violet-500/15 hover:border-violet-500/30",
  rose: "border-rose-500/20 hover:border-rose-500/35",
  emerald: "border-emerald-500/15 hover:border-emerald-500/30",
  sky: "border-sky-500/15",
  amber: "border-amber-500/15 hover:border-amber-500/30",
};

export function LiveFollowingFeed({ items }: { items: LiveFeedItem[] }) {
  if (items.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
        <div className="flex items-center gap-2">
          <HeatPill tone="rose" pulse>
            Personal
          </HeatPill>
          <h2 className="text-[11px] font-semibold text-zinc-300">Live following feed</h2>
        </div>
        <span className="text-[10px] text-zinc-600">{items.length} urgent</span>
      </div>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <article
            key={item.id}
            className={`rounded-lg border bg-zinc-950/90 px-2.5 py-2 feed-hover-lift ${TONE_BORDER[item.tone]} ${motionClass.cardEnterStagger(i)}`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-medium text-zinc-100 leading-snug flex-1">
                {item.headline}
              </p>
              <div className="flex items-center gap-1.5 shrink-0">
                {item.urgency === "high" && (
                  <span className="text-[8px] text-rose-400/90 font-medium uppercase">Now</span>
                )}
                <span className="text-[9px] text-zinc-600 tabular-nums">
                  {formatTimeAgo(item.created_at, true)}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">{item.detail}</p>
            <div className="flex gap-3 mt-1.5">
              {item.agent_slug && (
                <Link
                  href={`/agents/${item.agent_slug}`}
                  className="text-[9px] text-zinc-500 hover:text-violet-300"
                >
                  Agent →
                </Link>
              )}
              {item.market && (
                <Link
                  href={`/markets/${titleToSlug(item.market)}`}
                  className="text-[9px] text-zinc-500 hover:text-violet-300 truncate"
                >
                  Market →
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
