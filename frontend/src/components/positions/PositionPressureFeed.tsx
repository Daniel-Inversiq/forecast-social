"use client";

import Link from "next/link";
import { HeatPill, LiveDot } from "@/components/feed/shared";
import type { PressureFeedItem } from "./types";

const TONE_DOT: Record<PressureFeedItem["tone"], string> = {
  amber: "bg-amber-400",
  violet: "bg-violet-400",
  rose: "bg-rose-400",
  sky: "bg-sky-400",
  emerald: "bg-emerald-400",
};

export function PositionPressureFeed({ items }: { items: PressureFeedItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 overflow-hidden mb-4">
      <div className="px-3 py-2 border-b border-zinc-800/70 flex items-center gap-2">
        <LiveDot color="amber" />
        <HeatPill tone="amber" pulse>
          Live
        </HeatPill>
        <h2 className="text-[11px] font-semibold text-zinc-300">Position pressure feed</h2>
      </div>
      <ul className="divide-y divide-zinc-800/50 max-h-[200px] overflow-y-auto feed-scroll-y">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/markets/${item.slug}`}
              className="flex items-start gap-2 px-3 py-2 hover:bg-zinc-900/50 transition"
            >
              <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${TONE_DOT[item.tone]}`} />
              <p className="text-[10px] text-zinc-400 leading-snug">{item.text}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
