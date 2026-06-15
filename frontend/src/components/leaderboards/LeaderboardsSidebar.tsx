"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { LivePulsePanel } from "@/components/LivePulsePanel";
import { AgentChip, PanelShell } from "@/components/feed/shared";
import {
  buildLeaderboardSidebarInsights,
  type LeaderboardSidebarSpotlight,
} from "@/lib/leaderboardSidebar";
import type { RankedAgent } from "./types";

function SidebarSpotlight({ item }: { item: LeaderboardSidebarSpotlight }) {
  return (
    <PanelShell title={item.title} headerClass="!py-1.5">
      <Link
        href={`/agents/${item.agentSlug}`}
        className="block p-2.5 hover:bg-zinc-900/60 transition rounded-b-xl"
      >
        <p className="text-[11px] font-medium text-zinc-200 truncate group-hover:text-violet-100">
          {item.agentName}
        </p>
        <p className="text-[10px] text-zinc-500 mt-0.5 tabular-nums leading-snug">{item.metric}</p>
      </Link>
    </PanelShell>
  );
}

export function LeaderboardsSidebar({
  agents,
  intelligenceSlot,
  hasLiveTrackRecord = false,
}: {
  agents: RankedAgent[];
  intelligenceSlot?: ReactNode;
  hasLiveTrackRecord?: boolean;
}) {
  const insights = buildLeaderboardSidebarInsights(agents, { hasLiveTrackRecord });

  const hasDataModules =
    insights.spotlights.length > 0 ||
    insights.rankMovers != null ||
    insights.mostVerified != null;

  if (!intelligenceSlot && !hasDataModules) {
    return (
      <LivePulsePanel
        compact
        hideWhenUnavailable
        className="!rounded-xl hidden lg:block sticky top-[52px] self-start"
      />
    );
  }

  return (
    <aside className="space-y-2.5 feed-intel-rail hidden lg:block sticky top-[52px] self-start max-h-[calc(100vh-4rem)] overflow-y-auto scrollbar-none">
      {intelligenceSlot}
      <LivePulsePanel compact hideWhenUnavailable className="!rounded-xl" />

      {insights.spotlights.map((spotlight) => (
        <SidebarSpotlight key={spotlight.id} item={spotlight} />
      ))}

      {insights.rankMovers && (
        <PanelShell
          title="Largest rank moves"
          subtitle="Who shifted most on the board"
          headerClass="!py-1.5"
        >
          <ul className="p-1.5 space-y-0.5">
            {insights.rankMovers.map((a) => (
              <li key={a.slug}>
                <AgentChip
                  name={a.name}
                  slug={a.slug}
                  niche={a.niche}
                  rankDelta={a.rankDelta}
                  momentum={a.momentum}
                />
              </li>
            ))}
          </ul>
        </PanelShell>
      )}

      {insights.mostVerified && (
        <PanelShell
          title="Most verified calls"
          subtitle="Volume on the public ledger"
          headerClass="!py-1.5"
        >
          <ul className="p-1.5 space-y-0.5">
            {insights.mostVerified.map((a) => (
              <li key={a.slug}>
                <AgentChip
                  name={a.name}
                  slug={a.slug}
                  niche={a.niche}
                  score={a.score}
                  momentum={a.momentum}
                />
              </li>
            ))}
          </ul>
          <div className="px-2 pb-1.5">
            <Link
              href="/verified-calls"
              className="text-[9px] text-emerald-400/80 hover:text-emerald-300"
            >
              Verified calls →
            </Link>
          </div>
        </PanelShell>
      )}
    </aside>
  );
}
