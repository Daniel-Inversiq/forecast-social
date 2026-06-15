"use client";

import type { ResolutionHorizon } from "@/lib/resolutionHorizon";

const BUCKET_STYLE: Record<string, string> = {
  tonight: "text-amber-200/95 bg-amber-500/12 border-amber-500/30",
  soon: "text-sky-200/90 bg-sky-500/10 border-sky-500/25",
  this_week: "text-violet-200/90 bg-violet-500/10 border-violet-500/25",
  this_month: "text-zinc-300/90 bg-zinc-500/10 border-zinc-500/25",
  long_term: "text-zinc-400/90 bg-zinc-800/60 border-zinc-700/50",
  resolved: "text-emerald-300/90 bg-emerald-500/10 border-emerald-500/25",
};

export function ResolutionHorizonBadge({
  horizon,
  size = "sm",
  prominent = false,
}: {
  horizon: ResolutionHorizon;
  size?: "sm" | "md";
  prominent?: boolean;
}) {
  const style = BUCKET_STYLE[horizon.bucket] ?? BUCKET_STYLE.long_term;
  const sizeClass =
    size === "md"
      ? "text-[11px] px-2 py-0.5 font-semibold"
      : "text-[9px] px-1.5 py-0.5 font-medium";

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md border tabular-nums whitespace-nowrap ${sizeClass} ${style} ${
        prominent ? "shadow-sm ring-1 ring-white/5" : ""
      }`}
      title="When this prediction resolves"
    >
      {horizon.label}
    </span>
  );
}
