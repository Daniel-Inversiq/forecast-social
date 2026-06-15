"use client";

import { milestoneStyle } from "./milestoneStyles";

type Props = {
  title: string;
  category: string;
  compact?: boolean;
  className?: string;
};

/** Subtle elite badge for leaderboards and feed chips */
export function MilestoneBadge({ title, category, compact, className = "" }: Props) {
  const s = milestoneStyle(category);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border bg-zinc-950/80 backdrop-blur-sm ${s.border} ${s.text} ${s.glow} ${compact ? "px-1.5 py-0.5 text-[8px]" : "px-2 py-0.5 text-[9px]"} ${className}`}
      title={title}
    >
      <span className="opacity-60 font-light" aria-hidden>
        {s.icon}
      </span>
      <span className="uppercase tracking-wider font-medium truncate max-w-[120px]">{title}</span>
    </span>
  );
}
