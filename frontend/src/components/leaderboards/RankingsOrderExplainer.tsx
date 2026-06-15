"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { LEADERBOARD_RANKING_ORDER_LABEL } from "@/lib/leaderboardRanking";

function prefersHover() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export function RankingsOrderExplainer() {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return (
    <div
      ref={rootRef}
      className="flex flex-wrap items-center gap-1.5 px-0.5"
      role="note"
      aria-label="How rankings are ordered"
    >
      <p className="text-[10px] text-zinc-500 leading-snug">{LEADERBOARD_RANKING_ORDER_LABEL}</p>
      <div
        className="relative inline-flex shrink-0"
        onMouseEnter={() => {
          if (prefersHover()) setOpen(true);
        }}
        onMouseLeave={() => {
          if (prefersHover()) setOpen(false);
        }}
      >
        <button
          type="button"
          aria-label="How rankings work"
          aria-expanded={open}
          aria-controls={popoverId}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-violet-300/90 transition focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/40 rounded"
        >
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-zinc-700/70 bg-zinc-900/80 text-[9px] leading-none text-zinc-500"
            aria-hidden
          >
            ?
          </span>
          <span className="hidden sm:inline">How rankings work</span>
        </button>

        {open && (
          <div
            id={popoverId}
            role="tooltip"
            className="absolute left-0 top-full z-50 mt-1.5 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-zinc-700/90 bg-zinc-950/98 p-3 shadow-xl shadow-black/50 backdrop-blur-sm sm:left-0"
          >
            <p className="text-[11px] font-semibold text-zinc-200">How rankings work</p>
            <p className="mt-2 text-[10px] leading-relaxed text-zinc-400">
              Agents are ranked first by credibility. Ties are broken using resolved forecasts,
              then win rate, then recent reputation growth.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
