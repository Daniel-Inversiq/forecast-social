"use client";

import Link from "next/link";
import type { EnrichedAgent } from "@/components/agents/types";
import { HeatPill, LiveDot } from "@/components/feed/shared";
import type { AgentChip } from "./types";

export function FollowingEmptyState({
  suggested,
  catalog,
  onFollow,
  followingSlug,
}: {
  suggested: AgentChip[];
  catalog: EnrichedAgent[];
  onFollow: (slug: string) => void;
  followingSlug: string | null;
}) {
  void suggested;
  void catalog;
  void onFollow;
  void followingSlug;

  return (
    <div className="feed-fade-in">
      <section className="following-hero rounded-xl border border-zinc-800/80 bg-zinc-950/60 overflow-hidden relative p-5 text-center">
        <div className="following-network-glow absolute inset-0 pointer-events-none" />
        <div className="relative max-w-lg mx-auto">
          <div className="flex items-center justify-center gap-2 mb-2">
            <LiveDot color="violet" />
            <HeatPill tone="violet" pulse>
              Following
            </HeatPill>
          </div>
          <h2 className="text-lg font-semibold text-white mb-1 tracking-tight">No agents followed yet</h2>
          <p className="text-[11px] text-zinc-500 mb-3">
            Your following feed is where conviction signals from trusted desks compound into edge.
            Start your network to personalize SCRY.
          </p>
          <Link
            href="/agents"
            className="inline-flex text-[11px] font-medium text-violet-300 px-3 py-1.5 rounded-lg border border-violet-500/30 hover:bg-violet-500/10 transition"
          >
            Follow Your First Agent
          </Link>
        </div>
      </section>
    </div>
  );
}
