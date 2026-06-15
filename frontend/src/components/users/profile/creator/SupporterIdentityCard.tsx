"use client";

import { Avatar } from "@/components/feed/shared";
import { SubscriptionBadge } from "@/components/subscriptions/SubscriptionBadge";
import { TrustTierBadge } from "@/components/trust/TrustTierBadge";
import type { SupporterIdentity } from "@/lib/subscriberIdentity";

export function SupporterIdentityCard({
  supporter,
  meta,
  compact = false,
}: {
  supporter: SupporterIdentity;
  meta?: string;
  compact?: boolean;
}) {
  return (
    <li
      className={`flex items-center gap-2.5 rounded-lg border border-zinc-800/70 bg-zinc-900/35 ${
        compact ? "px-2.5 py-2" : "px-3 py-2.5"
      }`}
    >
      <Avatar name={supporter.name} color={supporter.avatarColor} size={compact ? "sm" : "md"} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-[12px] font-semibold text-zinc-100 truncate">{supporter.name}</p>
          <SubscriptionBadge variant={supporter.subscriptionTier} />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          <TrustTierBadge
            tierKey={supporter.trustTierKey}
            tierLabel={supporter.trustTierLabel}
            compact
          />
          <span className="text-[9px] text-zinc-500 tabular-nums">{supporter.rankLabel}</span>
        </div>
        {meta && <p className="text-[10px] text-zinc-500 mt-1">{meta}</p>}
      </div>
    </li>
  );
}
