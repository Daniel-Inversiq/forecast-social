"use client";

import Link from "next/link";
import { Avatar, HeatPill } from "@/components/feed/shared";
import type { NetworkSuggestion } from "./types";

export function NetworkDiscoveryPanel({
  suggestions,
  onFollow,
  followingSlug,
}: {
  suggestions: NetworkSuggestion[];
  onFollow?: (slug: string) => void;
  followingSlug?: string | null;
}) {
  if (suggestions.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-2 px-0.5">
        <HeatPill tone="emerald">Strategic</HeatPill>
        <h2 className="text-[11px] font-semibold text-zinc-300">
          Suggested additions to your network
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {suggestions.map((s) => (
          <article
            key={s.slug}
            className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-2.5 feed-hover-lift"
          >
            <div className="flex items-start gap-2 mb-2">
              <Avatar name={s.name} color={s.avatar_color} size="sm" />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/agents/${s.slug}`}
                  className="text-[11px] font-semibold text-zinc-100 hover:text-violet-300 transition"
                >
                  {s.name}
                </Link>
                <p className="text-[9px] text-zinc-600">{s.niche}</p>
              </div>
            </div>
            <p className="text-[10px] font-medium text-emerald-400/90 mb-1">{s.reason}</p>
            <p className="text-[10px] text-zinc-500 leading-snug line-clamp-2">{s.strategic}</p>
            {onFollow && (
              <button
                type="button"
                disabled={followingSlug === s.slug}
                onClick={() => onFollow(s.slug)}
                className="mt-2 w-full text-[10px] py-1.5 rounded-md border border-violet-500/30 text-violet-300 hover:bg-violet-500/10 transition disabled:opacity-50"
              >
                {followingSlug === s.slug ? "Adding…" : "Add to network"}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
