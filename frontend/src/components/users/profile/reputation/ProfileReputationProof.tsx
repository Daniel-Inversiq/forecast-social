"use client";

import { useMemo } from "react";
import type { EnrichedUserProfile } from "@/components/users/profile/types";
import type { PositionsPayload } from "@/components/positions/types";
import { resolveCurrentCredibility } from "@/lib/credibility";
import {
  countResolvedReceipts,
  hasConvictionOnRecord,
  hasRecentCredibilityGains,
} from "@/lib/profileSectionState";
import { getProfileScryReceipts } from "./receiptData";
import { TrackRecordSection } from "./TrackRecordSection";
import { ProfileConvictionRecordSection } from "./ProfileConvictionRecordSection";
import { getProfileConvictionRecords } from "./mockConvictionRecords";
import { RecentGainsSection } from "./RecentGainsSection";
import { SkillProfileDeepDive } from "./SkillProfileDeepDive";

export function ProfileReputationProof({
  profile,
  positions,
}: {
  profile: EnrichedUserProfile;
  positions: PositionsPayload | null;
}) {
  const receipts = useMemo(
    () => getProfileScryReceipts(profile, positions),
    [profile, positions],
  );
  const currentCredibility = useMemo(
    () => resolveCurrentCredibility(receipts, profile.reputation_score),
    [receipts, profile.reputation_score],
  );
  const convictionRecords = useMemo(
    () => getProfileConvictionRecords(profile.slug),
    [profile.slug],
  );
  const showGains = hasRecentCredibilityGains(receipts);
  const showTrackRecord = countResolvedReceipts(receipts) > 0;
  const showConvictionOnRecord = hasConvictionOnRecord(profile.feed_reads);

  if (!showGains && !showTrackRecord && !showConvictionOnRecord) {
    return (
      <div className="space-y-3 mb-3">
        <SkillProfileDeepDive profile={profile} />
        <section className="rounded-xl border border-dashed border-zinc-800/80 bg-zinc-950/40 px-4 py-6 text-center">
          <p className="text-sm font-medium text-zinc-300">No reputation proof on record yet</p>
          <p className="text-[11px] text-zinc-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
            Resolved forecasts, credibility gains, and public reads will populate this strip as you
            participate.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-3 mb-3">
      {showGains && (
        <RecentGainsSection receipts={receipts} currentCredibility={currentCredibility} />
      )}
      <SkillProfileDeepDive profile={profile} />
      {showTrackRecord && <TrackRecordSection receipts={receipts} />}
      {showConvictionOnRecord && (
        <ProfileConvictionRecordSection records={convictionRecords} />
      )}
    </div>
  );
}
