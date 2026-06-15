"use client";

import { useMemo } from "react";
import { usePublicReads } from "@/components/public-reads/PublicReadsProvider";
import { readsForAuthor } from "@/components/public-reads/publicReadEnrichment";
import { CreatorDashboardSection } from "./creator/CreatorDashboardSection";
import { SubscriberFunnel } from "./creator/SubscriberFunnel";
import { resolveCurrentCredibility } from "@/lib/credibility";
import { buildCreatorDashboardStats, formatCreatorMrr } from "@/lib/creatorDashboard";
import { buildEarningsReputationLoop } from "@/lib/earningsReputationLoop";
import { TRUST_SUBSCRIPTION_COPY } from "@/lib/forecasterSubscriptions";
import { buildSupporterIdentityRoster } from "@/lib/subscriberIdentity";
import { getProfileScryReceipts } from "./reputation/receiptData";
import { SupporterIdentityLayer } from "./creator/SupporterIdentityLayer";
import { EarningsReputationLoop } from "./creator/EarningsReputationLoop";
import type { EnrichedUserProfile } from "./types";
import type { PositionsPayload } from "@/components/positions/types";

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
        +{stats.subscribers} {stats.subscribers === 1 ? "subscriber" : "subscribers"}
      </p>
      <p className="text-[11px] text-amber-200/80 tabular-nums mt-0.5">
        +{formatCreatorMrr(stats.mrrDelta)} recurring from intelligence
      </p>
    </div>
  );
}

export function UserProfileSubscribersTab({
  profile,
  positions,
}: {
  profile: EnrichedUserProfile;
  positions: PositionsPayload | null;
}) {
  const { reads } = usePublicReads();
  const forecasterId = profile.slug ?? profile.name;

  const { stats, supporterRoster, earningsLoop } = useMemo(() => {
    const receipts = getProfileScryReceipts(profile, positions);
    const credibility = resolveCurrentCredibility(receipts, profile.reputation_score);
    const authorReads = readsForAuthor(reads, forecasterId);
    const readTitles = authorReads.map((r) => r.title);

    const dashboard = buildCreatorDashboardStats({
      forecasterId,
      credibility,
      followerCount: profile.follower_count,
      readTitles,
    });

    const roster = buildSupporterIdentityRoster(
      forecasterId,
      dashboard.audience.subscribers,
    );

    const loop = buildEarningsReputationLoop({
      forecasterId,
      reads: authorReads.length > 0 ? authorReads : undefined,
      readTitles: authorReads.length === 0 ? readTitles : undefined,
    });

    return { stats: dashboard, supporterRoster: roster, earningsLoop: loop };
  }, [profile, positions, reads, forecasterId]);

  return (
    <div className="space-y-3">
      <header className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-950/30 via-zinc-950/90 to-amber-950/15 px-3 py-3 sm:px-4 sm:py-3.5">
        <p className="text-[9px] font-bold uppercase tracking-wider text-violet-300/90">
          SCRY creator dashboard
        </p>
        <h2 className="text-sm font-semibold text-zinc-100 mt-0.5">
          How credibility becomes audience and revenue
        </h2>
        <p className="text-[11px] text-zinc-500 mt-1 max-w-xl">{TRUST_SUBSCRIPTION_COPY}</p>
      </header>

      <SupporterIdentityLayer roster={supporterRoster} />

      <CreatorDashboardSection title="Audience" hint="Followers who become subscribers">
        <div className="grid grid-cols-3 gap-2">
          <StatCell label="Followers" value={stats.audience.followers.toLocaleString()} />
          <StatCell label="Subscribers" value={stats.audience.subscribers.toLocaleString()} />
          <StatCell label="Conversion" value={`${stats.audience.conversionPct}%`} />
        </div>
      </CreatorDashboardSection>

      <CreatorDashboardSection
        title="Revenue from intelligence"
        hint="Recurring support from Pro and Premium tiers"
        accent="amber"
      >
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-3">
          <div>
            <p className="text-[8px] uppercase tracking-wider text-zinc-600">
              Monthly recurring revenue
            </p>
            <p className="text-2xl font-semibold text-amber-200/95 tabular-nums mt-0.5">
              {formatCreatorMrr(stats.revenue.mrr)}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatCell label="Pro supporters" value={stats.revenue.proCount} />
          <StatCell label="Premium supporters" value={stats.revenue.premiumCount} />
        </div>
      </CreatorDashboardSection>

      <CreatorDashboardSection title="Subscriber growth" hint="New supporters over time">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <GrowthBlock label="Last 7 days" stats={stats.growth.last7} />
          <GrowthBlock label="Last 30 days" stats={stats.growth.last30} />
        </div>
      </CreatorDashboardSection>

      <EarningsReputationLoop data={earningsLoop} />

      <CreatorDashboardSection title="Subscriber funnel" hint="Credibility → audience → supporters">
        <SubscriberFunnel funnel={stats.funnel} />
      </CreatorDashboardSection>
    </div>
  );
}
