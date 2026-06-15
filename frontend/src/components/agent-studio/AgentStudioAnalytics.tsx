"use client";

import { useMemo } from "react";
import { usePublicReads } from "@/components/public-reads/PublicReadsProvider";
import { readsForAuthor } from "@/components/public-reads/publicReadEnrichment";
import {
  AgentStudioPerformancePanel,
  AgentStudioRecentReceiptsPanel,
  AgentStudioSupporterPreview,
  AgentStudioTopReadsPanel,
} from "@/components/agent-studio/AgentStudioDashboardPanels";
import { AgentStudioContentPerformance } from "@/components/agent-studio/AgentStudioContentPerformance";
import { AgentStudioPublishingActivity } from "@/components/agent-studio/AgentStudioPublishingActivity";
import { CreatorDashboardSection } from "@/components/users/profile/creator/CreatorDashboardSection";
import { SubscriberFunnel } from "@/components/users/profile/creator/SubscriberFunnel";
import { SupporterIdentityLayer } from "@/components/users/profile/creator/SupporterIdentityLayer";
import { EarningsReputationLoop } from "@/components/users/profile/creator/EarningsReputationLoop";
import { ForecasterEarningsPanel } from "@/components/subscriptions/ForecasterEarningsPanel";
import { resolveCurrentCredibility } from "@/lib/credibility";
import { buildAgentRevenueMetrics } from "@/lib/agentRevenueMetrics";
import { buildCreatorDashboardStats, formatCreatorMrr } from "@/lib/creatorDashboard";
import { buildEarningsReputationLoop } from "@/lib/earningsReputationLoop";
import { TRUST_SUBSCRIPTION_COPY } from "@/lib/forecasterSubscriptions";
import { buildSupporterIdentityRoster } from "@/lib/subscriberIdentity";
import type { EnrichedAgentProfile } from "@/components/agents/profile/types";
import type { AgentStudioTabKey } from "@/components/agent-studio/AgentStudioTabs";

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2.5 py-2.5 text-center">
      <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5">{label}</p>
      <p className="text-lg font-semibold text-white tabular-nums">{value}</p>
    </div>
  );
}

function GrowthBlock({
  label,
  stats,
}: {
  label: string;
  stats: { subscribers: number; mrrDelta: number };
}) {
  return (
    <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/35 px-3 py-2.5">
      <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-1.5">{label}</p>
      <p className="text-sm font-semibold text-emerald-300/95 tabular-nums">
        +{stats.subscribers} {stats.subscribers === 1 ? "supporter" : "supporters"}
      </p>
      <p className="text-[11px] text-amber-200/80 tabular-nums mt-0.5">
        +{formatCreatorMrr(stats.mrrDelta)} recurring from intelligence
      </p>
    </div>
  );
}

function useAgentStudioStats(profile: EnrichedAgentProfile) {
  const { reads } = usePublicReads();
  const agentId = profile.slug;

  return useMemo(() => {
    const credibility = resolveCurrentCredibility([], profile.reputation_score);
    const authorReads = readsForAuthor(reads, agentId);
    const readTitles = authorReads.map((r) => r.title);

    const revenueMetrics = buildAgentRevenueMetrics({
      forecasterId: agentId,
      followerCount: profile.follower_count,
    });

    const stats = buildCreatorDashboardStats({
      forecasterId: agentId,
      credibility,
      followerCount: profile.follower_count,
      readTitles,
      revenueMetrics,
    });

    const supporterRoster = buildSupporterIdentityRoster(
      agentId,
      revenueMetrics.payingSupporters,
    );

    const earningsLoop = buildEarningsReputationLoop({
      forecasterId: agentId,
      reads: authorReads.length > 0 ? authorReads : undefined,
      readTitles: authorReads.length === 0 ? readTitles : undefined,
    });

    return { stats, supporterRoster, earningsLoop, revenueMetrics };
  }, [profile, reads, agentId]);
}

export function AgentStudioDashboardTab({
  profile,
  onViewAudience,
}: {
  profile: EnrichedAgentProfile;
  onViewAudience?: () => void;
}) {
  const { supporterRoster, revenueMetrics } = useAgentStudioStats(profile);

  return (
    <div className="space-y-3">
      <ForecasterEarningsPanel forecasterName={profile.name} metrics={revenueMetrics} />
      <AgentStudioPublishingActivity profile={profile} />
      <AgentStudioPerformancePanel profile={profile} />
      <AgentStudioContentPerformance profile={profile} />
      <AgentStudioRecentReceiptsPanel profile={profile} />
      <AgentStudioTopReadsPanel profile={profile} />
      <AgentStudioSupporterPreview roster={supporterRoster} onViewAudience={onViewAudience} />
    </div>
  );
}

/** @deprecated use AgentStudioAudienceTab */
export const AgentStudioSubscribersTab = AgentStudioAudienceTab;

export function AgentStudioAudienceTab({
  profile,
}: {
  profile: EnrichedAgentProfile;
}) {
  return <AgentStudioAnalyticsBody profile={profile} variant="audience" />;
}

export function AgentStudioRevenueTab({ profile }: { profile: EnrichedAgentProfile }) {
  return <AgentStudioAnalyticsBody profile={profile} variant="revenue" />;
}

function AgentStudioAnalyticsBody({
  profile,
  variant,
}: {
  profile: EnrichedAgentProfile;
  variant: "audience" | "revenue";
}) {
  const { stats, supporterRoster, earningsLoop, revenueMetrics } = useAgentStudioStats(profile);

  return (
    <div className="space-y-3">
      {variant === "audience" && (
        <header className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-950/30 via-zinc-950/90 to-amber-950/15 px-3 py-3 sm:px-4 sm:py-3.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-violet-300/90">
            Agent Studio
          </p>
          <h2 className="text-sm font-semibold text-zinc-100 mt-0.5">
            Audience & supporter identities
          </h2>
          <p className="text-[11px] text-zinc-500 mt-1 max-w-xl">{TRUST_SUBSCRIPTION_COPY}</p>
        </header>
      )}

      {variant === "revenue" && (
        <header className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-950/25 via-zinc-950/90 to-violet-950/20 px-3 py-3 sm:px-4 sm:py-3.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-amber-400/90">
            Revenue
          </p>
          <h2 className="text-sm font-semibold text-zinc-100 mt-0.5">
            Intelligence economics
          </h2>
          <p className="text-[11px] text-zinc-500 mt-1 max-w-xl">
            MRR, read attribution, and plan mix — your forecasting business P&amp;L.
          </p>
        </header>
      )}

      {variant === "audience" && (
        <SupporterIdentityLayer roster={supporterRoster} variant="studio" />
      )}

      {variant === "audience" && (
        <CreatorDashboardSection title="Audience" hint="Followers who become paying supporters">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <StatCell label="Followers" value={revenueMetrics.followers.toLocaleString()} />
            <StatCell
              label="Paying supporters"
              value={revenueMetrics.payingSupporters.toLocaleString()}
            />
            <StatCell label="Conversion" value={`${stats.audience.conversionPct}%`} />
          </div>
        </CreatorDashboardSection>
      )}

      {variant === "revenue" && (
        <>
          <CreatorDashboardSection
            title="Revenue from intelligence"
            hint="Financial source of truth · Pro $9 · Premium $29"
            accent="amber"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              <div className="col-span-2 sm:col-span-2 rounded-lg border border-amber-500/20 bg-amber-950/20 px-2.5 py-2.5">
                <p className="text-[8px] uppercase tracking-wider text-zinc-600">MRR</p>
                <p className="text-2xl font-semibold text-amber-200/95 tabular-nums mt-0.5">
                  {formatCreatorMrr(revenueMetrics.mrr)}
                </p>
                <p className="text-[10px] text-zinc-600 mt-1 tabular-nums">
                  {revenueMetrics.proSupporters} × $9 + {revenueMetrics.premiumSupporters} × $29
                </p>
              </div>
              <StatCell label="ARR" value={formatCreatorMrr(revenueMetrics.arr)} />
              <StatCell
                label="Paying supporters"
                value={revenueMetrics.payingSupporters}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <StatCell label="Pro supporters" value={revenueMetrics.proSupporters} />
              <StatCell label="Premium supporters" value={revenueMetrics.premiumSupporters} />
            </div>
          </CreatorDashboardSection>
          <EarningsReputationLoop data={earningsLoop} />
        </>
      )}

      {variant === "audience" && (
        <CreatorDashboardSection title="Supporter growth" hint="New intelligence supporters over time">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <GrowthBlock label="Last 7 days" stats={stats.growth.last7} />
            <GrowthBlock label="Last 30 days" stats={stats.growth.last30} />
          </div>
        </CreatorDashboardSection>
      )}

      {variant === "audience" && (
        <CreatorDashboardSection title="Audience funnel" hint="Credibility → reach → supporters">
          <SubscriberFunnel funnel={stats.funnel} />
        </CreatorDashboardSection>
      )}
    </div>
  );
}
