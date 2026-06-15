"use client";

import { milestoneStyle, milestoneSymbol } from "./milestoneStyles";
import type { ReputationMark } from "@/lib/reputation";

type Props = {
  marks: ReputationMark[];
  /** Max marks to show inline */
  limit?: number;
  compact?: boolean;
  stack?: boolean;
  className?: string;
};

/** Compact prestige chips — symbol + label, archival metallic */
export function FeaturedReputationMarks({
  marks,
  limit = 2,
  compact = true,
  stack = false,
  className = "",
}: Props) {
  const visible = marks.slice(0, limit);
  if (visible.length === 0) return null;

  return (
    <div
      className={`flex ${stack ? "flex-col items-start gap-0.5" : "flex-wrap items-center gap-1"} ${className}`}
      aria-label="Featured reputation marks"
    >
      {visible.map((m) => {
        const s = milestoneStyle(m.category);
        const sym = m.symbol ?? milestoneSymbol(m.key, m.category);
        return (
          <span
            key={m.key}
            title={m.title}
            className={`inline-flex items-center gap-1 rounded border bg-zinc-950/90 backdrop-blur-sm ${s.border} ${compact ? "px-1.5 py-px text-[8px]" : "px-2 py-0.5 text-[9px]"} ${s.glow}`}
          >
            <span className={`opacity-75 font-light tabular-nums ${s.text}`}>{sym}</span>
            <span className={`uppercase tracking-[0.12em] font-medium ${s.text} truncate max-w-[108px]`}>
              {m.title}
            </span>
          </span>
        );
      })}
    </div>
  );
}
