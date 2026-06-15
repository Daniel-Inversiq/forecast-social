"use client";

import type { ArcThreadHeaderMeta } from "./arcThreadGroups";
import { LiveDot } from "./shared";

const KIND_ACCENT: Record<ArcThreadHeaderMeta["kind"], string> = {
  continuing: "text-violet-400/70",
  rivalry: "text-rose-400/65",
  market: "text-sky-400/65",
  aftermath: "text-zinc-500",
};

export function ArcThreadHeader({ header }: { header: ArcThreadHeaderMeta }) {
  const accent = header.isActiveStory
    ? "text-rose-400/75"
    : KIND_ACCENT[header.kind];
  const prefix = header.serialLabel ?? header.title.split("·")[0]?.trim() ?? header.title;

  return (
    <div
      className={`arc-thread-header flex items-center gap-2 min-h-[20px] py-1 pl-2 pr-0.5 -mb-0.5 border-l ${
        header.isActiveStory ? "border-rose-500/35" : "border-zinc-700/40"
      }`}
      role="separator"
      aria-label={header.title}
    >
      {header.isActiveStory && (
        <span className="shrink-0 h-1 w-1 rounded-full bg-rose-400/70 animate-pulse" aria-hidden />
      )}
      <span className={`shrink-0 text-[9px] font-mono tracking-wide ${accent}`}>
        {prefix}
      </span>
      {!header.serialLabel && (
        <>
          <span className="scry-text-tertiary text-[9px] font-mono" aria-hidden>
            ·
          </span>
          <span className="min-w-0 truncate text-[10px] font-mono scry-text-secondary">
            {header.shortTitle}
          </span>
        </>
      )}
      <span className="shrink-0 text-[9px] font-mono tabular-nums scry-text-tertiary">
        {header.moveCount} moves
      </span>
      {header.latestStage && (
        <>
          <span className="text-zinc-700 text-[9px]" aria-hidden>
            ·
          </span>
          <span className="shrink-0 text-[9px] font-mono capitalize text-zinc-600">
            {header.latestStage}
          </span>
        </>
      )}
      {header.isLive && (
        <span className="shrink-0 flex items-center gap-0.5 ml-auto pr-0.5">
          <LiveDot color="violet" />
          <span className="text-[8px] font-mono uppercase tracking-wider text-violet-400/70">
            Watch Live
          </span>
        </span>
      )}
    </div>
  );
}
