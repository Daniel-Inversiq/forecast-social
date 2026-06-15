"use client";

import Link from "next/link";
import { HeatPill } from "@/components/feed/shared";
import type { FeaturedModule } from "./types";

const TONE_TEXT: Record<FeaturedModule["tone"], string> = {
  violet: "text-violet-300",
  rose: "text-rose-300",
  emerald: "text-emerald-300",
  sky: "text-sky-300",
  amber: "text-amber-300",
};

const TONE_BORDER: Record<FeaturedModule["tone"], string> = {
  violet: "border-violet-500/20 hover:border-violet-500/35",
  rose: "border-rose-500/20 hover:border-rose-500/35",
  emerald: "border-emerald-500/20 hover:border-emerald-500/35",
  sky: "border-sky-500/20 hover:border-sky-500/35",
  amber: "border-amber-500/20 hover:border-amber-500/35",
};

export function FeaturedMarketModules({ modules }: { modules: FeaturedModule[] }) {
  if (modules.length === 0) return null;

  return (
    <section className="mb-3">
      <div className="flex items-center gap-2 mb-2 px-0.5">
        <HeatPill tone="amber" pulse>
          Editorial
        </HeatPill>
        <span className="text-[11px] font-medium text-zinc-400">Featured intelligence</span>
      </div>
      <div className="relative -mx-0.5">
        <div className="flex gap-2 overflow-x-auto pb-0.5 px-0.5 feed-scroll-x scrollbar-none">
          {modules.map((mod) => (
            <Link
              key={mod.id}
              href={`/markets/${mod.marketSlug}`}
              className={`shrink-0 w-[148px] sm:w-[168px] rounded-xl border bg-zinc-950/90 p-2.5 feed-hover-lift feed-card-glow ${TONE_BORDER[mod.tone]}`}
            >
              <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-1">{mod.label}</p>
              <p
                className={`text-[11px] font-semibold leading-snug line-clamp-2 min-h-[2rem] ${TONE_TEXT[mod.tone]}`}
              >
                {mod.headline}
              </p>
              <p className="text-[9px] text-zinc-600 mt-1 truncate">{mod.sub}</p>
            </Link>
          ))}
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-zinc-950 to-transparent"
          aria-hidden
        />
      </div>
    </section>
  );
}
