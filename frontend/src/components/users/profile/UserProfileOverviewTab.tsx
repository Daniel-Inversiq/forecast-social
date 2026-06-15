"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ActivePositions } from "@/components/agents/profile/ActivePositions";
import { OpenPositionsEmptyState } from "@/components/positions/PositionsLedgerEmptyState";
import {
  enrichActive,
  groupActivePositionsByHorizon,
} from "@/components/positions/positionEnrichment";
import { PositionHorizonSections } from "@/components/positions/PositionHorizonSections";
import { countActivePositions } from "@/lib/activePositions";
import { MiniConvictionGraph } from "@/components/agents/MiniConvictionGraph";
import { ProfileReputationCabinet } from "@/components/agents/profile/ProfileReputationCabinet";
import { ProfileReputationCurve } from "@/components/agents/profile/ProfileReputationCurve";
import { HeatPill, MiniSparkline } from "@/components/feed/shared";
import type { PositionsPayload } from "@/components/positions/types";
import { hasPositionList, hasVerifiedReceiptsArchive } from "@/lib/profileSectionState";
import { UserForecastingBrief } from "@/components/brief/UserForecastingBrief";
import { UserPublicReads } from "./UserPublicReads";
import { UserPublicStatus } from "./UserPublicStatus";
import { UserReceiptArchiveSection } from "@/components/receipt-moment/UserReceiptArchiveSection";
import { ProfileRecentActivitySection } from "./ProfileRecentActivitySection";
import { getProfileScryReceipts } from "./reputation/receiptData";
import { resolveCurrentCredibility } from "@/lib/credibility";
import type { EnrichedUserProfile } from "./types";

export function UserProfileOverviewTab({
  profile,
  positions,
}: {
  profile: EnrichedUserProfile;
  positions: PositionsPayload | null;
}) {
  const activeCount = countActivePositions(positions, profile.positions.length);
  const enrichedActive = useMemo(
    () => (positions?.active_positions ?? []).map(enrichActive),
    [positions],
  );
  const activeByHorizon = useMemo(
    () => groupActivePositionsByHorizon(enrichedActive),
    [enrichedActive],
  );
  const showPositionList = hasPositionList(positions, profile.positions.length);
  const receipts = getProfileScryReceipts(profile, positions);
  const currentCredibility = resolveCurrentCredibility(receipts, profile.reputation_score);

  return (
    <div className="space-y-3">
      <UserPublicStatus block={profile.public_status} />
      {hasVerifiedReceiptsArchive(profile) && (
        <UserReceiptArchiveSection
          receipts={profile.verified_receipts!}
          username={profile.slug}
        />
      )}
      <UserPublicReads feedReads={profile.feed_reads} />
      <UserForecastingBrief />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-zinc-800/85 bg-zinc-950/90 p-4 feed-hover-lift">
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-2">Reputation summary</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-violet-500/15 bg-violet-950/15 px-2.5 py-2">
              <p className="text-[8px] text-zinc-600">Credibility</p>
              <p className="text-lg font-semibold text-violet-200 tabular-nums">
                {currentCredibility}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-500/15 bg-emerald-950/10 px-2.5 py-2">
              <p className="text-[8px] text-zinc-600">Verified</p>
              <p className="text-lg font-semibold text-emerald-300/90 tabular-nums">
                {profile.verified_calls}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2.5 py-2">
              <p className="text-[8px] text-zinc-600">Battle win rate</p>
              <p className="text-sm font-semibold text-zinc-200 tabular-nums">
                {profile.battle_win_rate}%
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2.5 py-2">
              <p className="text-[8px] text-zinc-600">Velocity</p>
              <p className="text-sm font-semibold text-zinc-200 tabular-nums">
                {profile.trend === "up" ? "+" : profile.trend === "down" ? "-" : ""}
                {profile.reputation_velocity}
              </p>
            </div>
          </div>
          {profile.has_live_reputation && profile.reputation_sparkline && (
            <div className="mt-3 pt-3 border-t border-zinc-800/60">
              <ProfileReputationCurve profile={profile} />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-zinc-800/85 bg-zinc-950/90 p-4 feed-hover-lift">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[9px] uppercase tracking-wider text-zinc-600">Conviction curve</p>
            <HeatPill tone="violet">Live</HeatPill>
          </div>
          <MiniConvictionGraph seed={profile.slug + "-user-conviction"} />
          <div className="flex items-center gap-2 mt-3">
            <MiniSparkline seed={profile.slug + "-curve"} tone="violet" width={120} height={20} />
            <p className="text-[10px] text-zinc-500">
              {activeCount} active · {positions?.stats.resolved_count ?? 0} resolved
            </p>
          </div>
        </div>
      </div>

      {profile.reputation && (profile.reputation.milestones?.length ?? 0) > 0 && (
        <ProfileReputationCabinet reputation={profile.reputation} />
      )}

      <div>
        <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Live positions
          </p>
          <Link href="/me/positions" className="text-[10px] text-violet-400 hover:text-violet-300">
            Full positions hub →
          </Link>
        </div>
        {showPositionList ? (
          enrichedActive.length > 0 ? (
            <PositionHorizonSections groups={activeByHorizon} />
          ) : (
            <ActivePositions profile={profile} />
          )
        ) : (
          <OpenPositionsEmptyState compact activeCount={activeCount} />
        )}
      </div>

      <ProfileRecentActivitySection
        profile={profile}
        positions={positions}
        scryReceipts={receipts}
        variant="feed"
      />
    </div>
  );
}
