"use client";

import type { FeedCredibilitySplit } from "./feedEnrichment";

export function CredibilityMiniBar({
  split,
  spread,
}: {
  split: FeedCredibilitySplit;
  spread?: number | null;
}) {
  const yes = split.yes.total_reputation;
  const no = split.no.total_reputation;
  const total = yes + no || 1;
  const yesPct = Math.round((100 * yes) / total);
  const noPct = 100 - yesPct;

  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-[9px] scry-text-tertiary shrink-0 w-14">
        YES <span className="text-violet-300/85 tabular-nums font-semibold">{yesPct}%</span>
      </span>
      <div className="flex-1 min-w-0 h-0.5 rounded-full overflow-hidden flex bg-zinc-800/70">
        <div className="h-full bg-violet-500/65" style={{ width: `${yesPct}%` }} />
        <div className="h-full bg-zinc-500/45" style={{ width: `${noPct}%` }} />
      </div>
      <span className="text-[9px] scry-text-tertiary shrink-0 w-14 text-right">
        NO <span className="scry-text-secondary tabular-nums font-medium">{noPct}%</span>
      </span>
      {spread != null && (
        <span className="text-[9px] text-amber-400/55 tabular-nums shrink-0 hidden sm:inline">
          {spread}pt
        </span>
      )}
    </div>
  );
}
