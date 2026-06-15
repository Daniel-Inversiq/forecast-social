"use client";

import { useMemo } from "react";
import type { EnrichedAgentProfile } from "@/components/agents/profile/types";
import { usePublicReads } from "@/components/public-reads/PublicReadsProvider";
import {
  buildAgentContentPerformance,
  type OriginPerformanceBucket,
} from "@/lib/agentContentPerformance";
import { CreatorDashboardSection } from "@/components/users/profile/creator/CreatorDashboardSection";

function BucketPanel({
  title,
  subtitle,
  bucket,
  accent,
}: {
  title: string;
  subtitle: string;
  bucket: OriginPerformanceBucket;
  accent: "violet" | "cyan" | "amber";
}) {
  const border =
    accent === "violet"
      ? "border-violet-500/20"
      : accent === "cyan"
        ? "border-cyan-500/20"
        : "border-amber-500/20";

  return (
    <div className={`rounded-xl border ${border} bg-zinc-900/35 p-3 space-y-2`}>
      <div>
        <p className="text-xs font-semibold text-zinc-100">{title}</p>
        <p className="text-[10px] text-zinc-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Reads published" value={bucket.readsPublished} />
        <Metric label="Avg credibility gain" value={bucket.avgCredibilityGain} signed />
        <Metric label="Win rate" value={`${bucket.winRate}%`} />
        <Metric label="Subscriber conversion" value={`${bucket.subscriberConversionRate}%`} />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  signed,
}: {
  label: string;
  value: string | number;
  signed?: boolean;
}) {
  const num = typeof value === "number" ? value : null;
  const tone =
    signed && num != null
      ? num >= 0
        ? "text-emerald-300/95"
        : "text-rose-300/95"
      : "text-white";

  return (
    <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/50 px-2 py-1.5">
      <p className="text-[8px] uppercase tracking-wider text-zinc-600">{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${tone}`}>
        {signed && num != null && num > 0 ? "+" : ""}
        {value}
      </p>
    </div>
  );
}

export function AgentStudioContentPerformance({ profile }: { profile: EnrichedAgentProfile }) {
  const { reads } = usePublicReads();
  const perf = useMemo(
    () => buildAgentContentPerformance(reads, profile.slug),
    [reads, profile.slug],
  );

  return (
    <CreatorDashboardSection
      title="Content performance"
      hint="Creator judgment vs AI — internal analytics only"
      accent="violet"
    >
      <div className="space-y-3">
        <BucketPanel
          title="Creator-authored reads"
          subtitle="You wrote and published directly as the agent"
          bucket={perf.creator}
          accent="violet"
        />
        <BucketPanel
          title="AI reads"
          subtitle="Approved without edits from AI queue"
          bucket={perf.ai}
          accent="cyan"
        />
        <BucketPanel
          title="AI-approved reads"
          subtitle="AI draft you reviewed and approved"
          bucket={perf.aiApproved}
          accent="amber"
        />
      </div>
    </CreatorDashboardSection>
  );
}
