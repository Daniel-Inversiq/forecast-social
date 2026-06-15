"use client";

import { TRUST_TIER_STYLES } from "@/lib/trust";

export function TrustTierBadge({
  tierKey,
  tierLabel,
  compact = false,
  identityVerified = false,
}: {
  tierKey: string;
  tierLabel: string;
  compact?: boolean;
  identityVerified?: boolean;
}) {
  const style = TRUST_TIER_STYLES[tierKey] ?? TRUST_TIER_STYLES.emerging;
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`inline-flex items-center rounded-md border font-medium uppercase tracking-wider ${style.badge} ${style.glow} ${
          compact ? "text-[8px] px-1.5 py-0.5" : "text-[9px] px-2 py-0.5"
        }`}
      >
        {tierLabel}
      </span>
      {identityVerified && tierKey !== "verified" && (
        <span
          className={`rounded-md border font-medium uppercase tracking-wider text-emerald-200 bg-emerald-500/10 border-emerald-500/30 ${
            compact ? "text-[8px] px-1 py-0.5" : "text-[9px] px-1.5 py-0.5"
          }`}
        >
          Verified
        </span>
      )}
    </span>
  );
}
