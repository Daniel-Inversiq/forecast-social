"use client";

import { useEffect, useMemo } from "react";
import type { EnrichedAgentProfile } from "@/components/agents/profile/types";
import { usePublicReads } from "@/components/public-reads/PublicReadsProvider";
import { publishingActivitySummary } from "@/lib/agentContentPerformance";
import { CreatorDashboardSection } from "@/components/users/profile/creator/CreatorDashboardSection";

export function AgentStudioPublishingActivity({ profile }: { profile: EnrichedAgentProfile }) {
  const { reads, aiQueue, ensureAiQueue } = usePublicReads();

  useEffect(() => {
    ensureAiQueue(profile.slug);
  }, [ensureAiQueue, profile.slug]);

  const pendingAi = useMemo(
    () => aiQueue.filter((q) => q.agentSlug === profile.slug && q.status === "pending").length,
    [aiQueue, profile.slug],
  );

  const activity = useMemo(
    () => publishingActivitySummary(reads, profile.slug, pendingAi),
    [reads, profile.slug, pendingAi],
  );

  const cells = [
    { label: "Published this month", value: activity.publishedThisMonth },
    { label: "Pending AI drafts", value: activity.pendingAiDrafts },
    { label: "Open reads", value: activity.openReads },
    { label: "Resolved reads", value: activity.resolvedReads },
    { label: "Receipts earned", value: activity.receiptsEarned },
  ];

  return (
    <CreatorDashboardSection
      title="Publishing activity"
      hint="Hybrid intelligence pipeline — drafts, publishes, and receipts"
      accent="cyan"
    >
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {cells.map((c) => (
          <div
            key={c.label}
            className="rounded-lg border border-zinc-800/70 bg-gradient-to-b from-zinc-900/50 to-zinc-950/80 px-2.5 py-2.5"
          >
            <p className="text-[8px] uppercase tracking-wider text-zinc-600 leading-tight">{c.label}</p>
            <p className="text-lg font-semibold text-white tabular-nums mt-0.5">{c.value}</p>
          </div>
        ))}
      </div>
    </CreatorDashboardSection>
  );
}
