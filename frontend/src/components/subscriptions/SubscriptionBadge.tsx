"use client";

import type { SubscriptionTier } from "@/lib/forecasterSubscriptions";

type BadgeVariant =
  | "pro"
  | "premium"
  | "subscriber_only"
  | "early_signal"
  | "private_desk";

const STYLES: Record<BadgeVariant, string> = {
  pro: "border-amber-500/35 bg-amber-500/10 text-amber-200/95",
  premium: "border-violet-500/40 bg-violet-500/12 text-violet-200/95",
  subscriber_only: "border-cyan-500/30 bg-cyan-500/8 text-cyan-200/90",
  early_signal: "border-emerald-500/25 bg-emerald-500/8 text-emerald-200/85",
  private_desk: "border-fuchsia-500/30 bg-fuchsia-500/8 text-fuchsia-200/90",
};

const LABELS: Record<BadgeVariant, string> = {
  pro: "Pro",
  premium: "Premium",
  subscriber_only: "Subscriber-only",
  early_signal: "Early Signal",
  private_desk: "Private Desk",
};

export function SubscriptionBadge({
  variant,
  className = "",
}: {
  variant: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${STYLES[variant]} ${className}`}
    >
      {LABELS[variant]}
    </span>
  );
}

export function tierToBadgeVariant(tier: SubscriptionTier): BadgeVariant | null {
  if (tier === "pro") return "pro";
  if (tier === "premium") return "premium";
  return null;
}
