"use client";

import { HeatPill, LiveDot, MiniSparkline } from "@/components/feed/shared";
import type { OverviewCard } from "./types";

const TONE_TEXT: Record<OverviewCard["tone"], string> = {
  violet: "text-violet-300",
  rose: "text-rose-300",
  emerald: "text-emerald-300",
  sky: "text-sky-300",
  amber: "text-amber-300",
};

export function NetworkOverviewStrip({ cards }: { cards: OverviewCard[] }) {
  return (
    <section className="mb-3">
      <div className="flex items-center justify-between gap-2 mb-1.5 px-0.5">
        <div className="flex items-center gap-2">
          <LiveDot color="rose" />
          <HeatPill tone="rose" pulse>
            Live
          </HeatPill>
          <span className="text-[11px] font-medium text-zinc-400">Network pulse</span>
        </div>
        <span className="text-[10px] text-zinc-600 hidden sm:inline">
          Pressure · mood · factions · timing
        </span>
      </div>
      <div className="relative -mx-0.5">
        <div className="flex gap-2 overflow-x-auto pb-0.5 px-0.5 feed-scroll-x scrollbar-none">
          {cards.map((card) => (
            <div
              key={card.id}
              className="following-strip-card shrink-0 w-[148px] sm:w-[164px] flex flex-col gap-1 p-2 rounded-xl border border-zinc-800/80 bg-zinc-950/90 feed-hover-lift"
            >
              <p className="text-[8px] uppercase tracking-wider text-zinc-600 leading-tight">
                {card.label}
              </p>
              <p
                className={`text-[11px] font-semibold leading-snug line-clamp-2 min-h-[2rem] ${TONE_TEXT[card.tone]}`}
              >
                {card.value}
              </p>
              <p className="text-[9px] text-zinc-600 truncate">{card.sub}</p>
              <div className="flex items-center justify-between mt-auto pt-1">
                {card.pulse && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400/40" />
                    <span className="relative rounded-full h-1.5 w-1.5 bg-violet-500/80" />
                  </span>
                )}
                <MiniSparkline
                  seed={card.seed}
                  tone={card.tone === "rose" ? "amber" : card.tone === "emerald" ? "emerald" : "violet"}
                  width={44}
                  height={12}
                />
              </div>
            </div>
          ))}
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-zinc-950 via-zinc-950/80 to-transparent"
          aria-hidden
        />
      </div>
    </section>
  );
}
