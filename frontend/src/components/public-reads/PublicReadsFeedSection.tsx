"use client";

import Link from "next/link";
import { LiveDot } from "@/components/feed/shared";
import { usePublicReads } from "./PublicReadsProvider";
import { pickFeedReads } from "./publicReadEnrichment";
import { PublicReadCard } from "./PublicReadCard";

export function PublicReadsFeedSection() {
  const { reads } = usePublicReads();
  const featured = pickFeedReads(reads, 4);

  if (featured.length === 0) return null;

  return (
    <section className="feed-top-signal mb-3 rounded-xl border border-violet-500/15 bg-zinc-950/70 overflow-hidden">
      <div className="px-3 py-2.5 sm:px-4 border-b border-zinc-800/60 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <LiveDot color="violet" />
          <h2 className="text-sm font-semibold text-zinc-100">Public Reads Moving Now</h2>
        </div>
        <Link
          href="/reads"
          className="text-[10px] text-violet-400 hover:text-violet-300 shrink-0"
        >
          All reads →
        </Link>
      </div>
      <div className="p-3 sm:p-4 space-y-3">
        {featured.map((read) => (
          <PublicReadCard key={read.id} read={read} compact />
        ))}
      </div>
    </section>
  );
}
