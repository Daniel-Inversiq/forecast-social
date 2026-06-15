"use client";

import { milestoneStyle, milestoneSymbol } from "./milestoneStyles";
import type { ReputationMark } from "@/lib/reputation";

const CATEGORY_HINT: Record<string, string> = {
  timing: "Timing edge on the public record",
  accuracy: "Calibration-backed verified calls",
  contrarian: "Consensus-breaking conviction",
  battle: "Public disagreement outcomes",
  reputation: "Standing on the reputation ledger",
  specialization: "Domain-specific forecasting edge",
};

function MarkTooltip({ mark }: { mark: ReputationMark }) {
  const s = milestoneStyle(mark.category);
  const sym = mark.symbol ?? milestoneSymbol(mark.key, mark.category);
  const hint = CATEGORY_HINT[mark.category] ?? "Prestige mark on public identity";

  return (
    <span
      className={`group/mark relative inline-flex items-center justify-center w-6 h-6 rounded border bg-zinc-950/95 backdrop-blur-sm ${s.border} ${s.glow} cursor-default`}
      aria-label={mark.title}
    >
      <span className={`text-[11px] leading-none ${s.text} opacity-90`}>{sym}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full right-0 mt-1.5 z-50 w-44 rounded-lg border border-zinc-700/80 bg-zinc-950/98 px-2.5 py-2 opacity-0 scale-95 group-hover/mark:opacity-100 group-hover/mark:scale-100 transition shadow-xl shadow-black/40"
      >
        <p className={`text-[10px] font-semibold tracking-wide ${s.text}`}>{mark.title}</p>
        <p className="text-[8px] uppercase tracking-[0.16em] text-zinc-600 mt-0.5">{mark.category}</p>
        <p className="text-[9px] text-zinc-500 mt-1 leading-snug">{hint}</p>
      </span>
    </span>
  );
}

/** Navbar prestige marks — symbols on mobile, optional labels on md+ */
export function NavFeaturedReputationMarks({
  marks,
  limit = 2,
}: {
  marks: ReputationMark[];
  limit?: number;
}) {
  const visible = marks.slice(0, limit);
  if (visible.length === 0) return null;

  return (
    <span
      className="inline-flex items-center gap-1 shrink-0"
      aria-label="Featured reputation marks"
    >
      {visible.map((m) => {
        const s = milestoneStyle(m.category);
        const sym = m.symbol ?? milestoneSymbol(m.key, m.category);
        return (
          <span key={m.key} className="inline-flex items-center gap-1">
            <span className="md:hidden">
              <MarkTooltip mark={m} />
            </span>
            <span
              className={`hidden md:inline-flex items-center gap-1 rounded border bg-zinc-950/90 backdrop-blur-sm px-1.5 py-px ${s.border} ${s.glow}`}
              title={`${m.title} · ${m.category}`}
            >
              <span className={`text-[9px] leading-none ${s.text} opacity-80`}>{sym}</span>
              <span
                className={`uppercase tracking-[0.14em] font-medium text-[7px] max-w-[72px] truncate ${s.text}`}
              >
                {m.title}
              </span>
            </span>
          </span>
        );
      })}
    </span>
  );
}
