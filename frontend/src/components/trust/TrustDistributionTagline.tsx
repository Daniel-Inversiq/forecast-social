"use client";

import { DISTRIBUTION_TAGLINE } from "@/lib/trust";

export function TrustDistributionTagline({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <p
      className={`${compact ? "text-[9px]" : "text-[10px]"} text-cyan-400/80 italic ${className}`}
      title="Distribution is earned through forecasting quality — not payment or activity volume."
    >
      {DISTRIBUTION_TAGLINE}
    </p>
  );
}
