"use client";

import type { ReactNode } from "react";
import { HeatPill } from "@/components/feed/shared";

export function BriefIntelligenceCard({
  label,
  ticker,
  children,
  tone = "amber",
  className = "",
}: {
  label: string;
  ticker?: string;
  children: ReactNode;
  tone?: "amber" | "zinc" | "emerald" | "rose";
  className?: string;
}) {
  const border =
    tone === "amber"
      ? "border-amber-500/20"
      : tone === "emerald"
        ? "border-emerald-500/20"
        : tone === "rose"
          ? "border-rose-500/20"
          : "border-zinc-700/60";

  return (
    <article
      className={`brief-intel-card rounded-lg border ${border} bg-zinc-950/95 ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="brief-intel-label">{label}</p>
        {ticker && (
          <HeatPill tone={tone === "zinc" ? "sky" : tone}>{ticker}</HeatPill>
        )}
      </div>
      {children}
    </article>
  );
}
