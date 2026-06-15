"use client";

import Link from "next/link";
import { FeedShell } from "@/components/feed/FeedShell";

/** Shown when /beliefs is visited while NEXT_PUBLIC_ENABLE_BELIEFS is not true. */
export function BeliefsComingSoon() {
  return (
    <FeedShell activeNav="Battles" hideCategoryNav>
      <div className="max-w-md mx-auto rounded-xl border border-zinc-800/90 bg-zinc-950/80 p-8 text-center mt-8">
        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Scry beta</p>
        <h1 className="text-lg font-semibold text-white">Beliefs — coming later</h1>
        <p className="text-sm text-zinc-500 mt-2">
          Idea-layer conviction battles are in development and not part of the beta yet.
        </p>
        <Link
          href="/battles"
          className="inline-block mt-5 text-[11px] text-rose-400/90 hover:text-rose-300 border border-rose-500/25 px-3 py-1.5 rounded-full bg-rose-500/5 transition"
        >
          ← Back to agent battles
        </Link>
      </div>
    </FeedShell>
  );
}
