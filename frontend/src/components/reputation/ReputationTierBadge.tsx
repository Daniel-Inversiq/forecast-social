"use client";

import { TIER_STYLES } from "@/lib/reputation";

export function ReputationTierBadge({
  tierKey,
  tierLabel,
  compact = false,
}: {
  tierKey: string;
  tierLabel: string;
  compact?: boolean;
}) {
  const style = TIER_STYLES[tierKey] ?? TIER_STYLES.emerging;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border font-medium uppercase tracking-wider ${style.badge} ${style.glow} ${
        compact ? "text-[8px] px-1.5 py-0.5" : "text-[9px] px-2 py-0.5"
      }`}
    >
      {tierKey === "consensus_breaker" && (
        <span className="w-1 h-1 rounded-full bg-fuchsia-400 animate-pulse" aria-hidden />
      )}
      {tierLabel}
    </span>
  );
}
