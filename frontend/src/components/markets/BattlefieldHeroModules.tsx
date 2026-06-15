"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HeatPill } from "@/components/feed/shared";
import { NarrativeStateBadge } from "./NarrativeStateBadge";
import type { BattlefieldModule } from "./types";

const TONE_TEXT: Record<BattlefieldModule["tone"], string> = {
  violet: "text-violet-300",
  rose: "text-rose-300",
  emerald: "text-emerald-300",
  sky: "text-sky-300",
  amber: "text-amber-300",
};

const TONE_BORDER: Record<BattlefieldModule["tone"], string> = {
  violet: "border-violet-500/25 hover:border-violet-500/45",
  rose: "border-rose-500/30 hover:border-rose-500/50 markets-battlefield-hot",
  emerald: "border-emerald-500/25 hover:border-emerald-500/40",
  sky: "border-sky-500/25 hover:border-sky-500/40",
  amber: "border-amber-500/25 hover:border-amber-500/40",
};

export function BattlefieldHeroModules({ modules }: { modules: BattlefieldModule[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (modules.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % modules.length), 5200);
    return () => clearInterval(id);
  }, [modules.length]);

  if (modules.length === 0) return null;

  const active = modules[index % modules.length];

  return (
    <div className="mb-3 rounded-xl border border-zinc-800/80 bg-zinc-950/70 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-r from-rose-950/20 via-violet-950/15 to-transparent pointer-events-none" />
      <div className="relative px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <HeatPill tone="rose" pulse>
              Battlefield
            </HeatPill>
            <span className="text-[10px] text-zinc-500">What the network is fighting over</span>
          </div>
          <div className="flex gap-1">
            {modules.map((m, i) => (
              <button
                key={m.id}
                type="button"
                aria-label={`Show ${m.label}`}
                onClick={() => setIndex(i)}
                className={`h-1 rounded-full transition-all ${
                  i === index % modules.length ? "w-4 bg-violet-400" : "w-1.5 bg-zinc-700"
                }`}
              />
            ))}
          </div>
        </div>

        <Link
          href={`/markets/${active.marketSlug}`}
          className={`block rounded-lg border bg-zinc-900/50 p-3 feed-hover-lift transition-colors ${TONE_BORDER[active.tone]}`}
        >
          <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-1">{active.label}</p>
          <p className={`text-sm font-semibold leading-snug ${TONE_TEXT[active.tone]}`}>
            {active.headline}
          </p>
          <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2">{active.sub}</p>
          {active.narrativeState && (
            <div className="mt-2">
              <NarrativeStateBadge state={active.narrativeState} compact />
            </div>
          )}
        </Link>

        <div className="hidden sm:flex gap-2 mt-2 overflow-x-auto feed-scroll-x scrollbar-none">
          {modules
            .filter((m) => m.id !== active.id)
            .slice(0, 4)
            .map((m) => (
              <Link
                key={m.id}
                href={`/markets/${m.marketSlug}`}
                className="shrink-0 text-[9px] px-2 py-1 rounded-md border border-zinc-800/80 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600/80"
              >
                <span className="text-zinc-600">{m.label} · </span>
                <span className="text-zinc-400">{m.headline.slice(0, 36)}…</span>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
