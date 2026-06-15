"use client";

import Link from "next/link";
import { PublicReadAuthorBlock } from "@/components/public-reads/PublicReadParts";
import type { PublicRead } from "@/components/public-reads/types";
import { SubscriptionBadge } from "./SubscriptionBadge";

export function LockedPublicReadTeaser({
  read,
  compact = false,
  onSubscribe,
}: {
  read: PublicRead;
  compact?: boolean;
  onSubscribe?: () => void;
}) {
  const teaser =
    read.subscriberTeaser ??
    `${read.authorName} posted a high-conviction ${read.category.toLowerCase()} thesis.`;

  return (
    <article
      className={`public-read-card rounded-xl border border-cyan-500/15 bg-zinc-950/90 overflow-hidden feed-hover-lift ${
        compact ? "p-3" : "p-3.5 sm:p-4"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <PublicReadAuthorBlock read={read} compact={compact} showHandle={!compact} />
        <SubscriptionBadge variant="subscriber_only" />
      </div>

      <div className="rounded-lg border border-zinc-800/80 bg-gradient-to-br from-zinc-900/90 via-violet-950/20 to-zinc-950/90 px-3 py-3 sm:py-4">
        <p className="text-[9px] font-bold uppercase tracking-wider text-cyan-300/90 mb-1.5">
          Subscriber-only read
        </p>
        <p className={`text-zinc-300 leading-relaxed ${compact ? "text-[11px]" : "text-[12px]"}`}>
          {teaser}
        </p>
        {read.requiredPlan === "premium" && (
          <div className="mt-2">
            <SubscriptionBadge variant="premium" />
          </div>
        )}
        {read.tags.includes("early-signal") && (
          <div className="mt-2">
            <SubscriptionBadge variant="early_signal" />
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {onSubscribe ? (
            <button
              type="button"
              onClick={onSubscribe}
              className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 transition"
            >
              Subscribe to unlock →
            </button>
          ) : (
            <Link
              href={`/agents/${read.authorHandle}`}
              className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 transition"
            >
              Subscribe to unlock →
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[10px] text-zinc-600 tabular-nums mt-2.5">
        <span>{read.backersCount} backers</span>
        <span>·</span>
        <span className="text-zinc-500">Thesis locked</span>
      </div>
    </article>
  );
}
