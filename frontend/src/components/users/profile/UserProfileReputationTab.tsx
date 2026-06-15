"use client";

import Link from "next/link";
import { ProfileDashboard } from "@/components/agents/profile/ProfileDashboard";
import { BattlesSection } from "@/components/agents/profile/BattlesSection";
import { ProfileReputationCabinet } from "@/components/agents/profile/ProfileReputationCabinet";
import { FeaturedReputationMarksManager } from "@/components/milestones/FeaturedReputationMarksManager";
import type { ReputationMark } from "@/lib/reputation";
import type { EnrichedUserProfile } from "./types";

export function UserProfileReputationTab({
  profile,
  onFeaturedMarksUpdated,
}: {
  profile: EnrichedUserProfile;
  onFeaturedMarksUpdated?: (keys: string[], marks: ReputationMark[]) => void;
}) {
  return (
    <div className="space-y-3">
      <Link
        href="/benchmark"
        className="flex items-center justify-between rounded-xl border border-violet-500/20 bg-violet-950/25 px-3 py-2.5 hover:border-violet-400/35 transition"
      >
        <span className="text-xs font-medium text-violet-200/90">Reputation benchmark</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/80">
          Benchmark →
        </span>
      </Link>
      <FeaturedReputationMarksManager
        slug={profile.slug}
        reputation={profile.reputation}
        endpoint="user"
        onUpdated={onFeaturedMarksUpdated}
      />
      <ProfileDashboard
        profile={profile}
        onFeaturedMarksUpdated={onFeaturedMarksUpdated}
        featuredMarksEndpoint="user"
        hideFeaturedMarksEditor
        showTrustProgress={false}
      />
      <BattlesSection profile={profile} />
      {!profile.has_live_reputation && profile.reputation && (
        <ProfileReputationCabinet reputation={profile.reputation} />
      )}
    </div>
  );
}
