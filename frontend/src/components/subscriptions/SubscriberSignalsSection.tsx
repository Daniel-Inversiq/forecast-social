"use client";

import { useMemo } from "react";
import Link from "next/link";
import { LiveDot } from "@/components/feed/shared";
import { useForecasterSubscriptions } from "@/context/ForecasterSubscriptionsProvider";
import { usePublicReads } from "@/components/public-reads/PublicReadsProvider";
import { canAccessRead } from "@/lib/forecasterSubscriptions";
import { PublicReadCard } from "@/components/public-reads/PublicReadCard";
import { LockedPublicReadTeaser } from "./LockedPublicReadTeaser";
import { TRUST_SUBSCRIPTION_COPY } from "@/lib/forecasterSubscriptions";

const SIGNAL_AUTHOR_SLUGS = new Set([
  "macro-oracle",
  "doombot",
  "fed-watcher",
  "neural-scout",
]);

export function SubscriberSignalsSection() {
  const { reads } = usePublicReads();
  const { getTier } = useForecasterSubscriptions();

  const signals = useMemo(() => {
    return reads
      .filter(
        (r) =>
          r.visibility === "subscriber_only" &&
          SIGNAL_AUTHOR_SLUGS.has(r.authorHandle),
      )
      .slice(0, 3);
  }, [reads]);

  if (signals.length === 0) return null;

  return (
    <section className="feed-top-signal mb-3 rounded-xl border border-amber-500/12 bg-zinc-950/70 overflow-hidden">
      <div className="px-3 py-2.5 sm:px-4 border-b border-zinc-800/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <LiveDot color="amber" />
            <h2 className="text-sm font-semibold text-zinc-100">Subscriber Signals</h2>
          </div>
          <Link
            href="/reads"
            className="text-[10px] text-amber-400/90 hover:text-amber-300 shrink-0"
          >
            All reads →
          </Link>
        </div>
        <p className="text-[10px] text-zinc-500 mt-1">
          High-conviction reads from forecasters you follow.
        </p>
      </div>
      <div className="p-3 sm:p-4 space-y-3">
        {signals.map((read) => {
          const tier = getTier(read.authorHandle);
          const unlocked = canAccessRead(read, tier);
          if (unlocked) {
            return <PublicReadCard key={read.id} read={read} compact />;
          }
          return <LockedPublicReadTeaser key={read.id} read={read} compact />;
        })}
      </div>
      <p className="px-3 pb-2.5 text-[9px] text-zinc-600 sm:px-4">{TRUST_SUBSCRIPTION_COPY}</p>
    </section>
  );
}
