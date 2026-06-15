"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ActivePositions } from "@/components/agents/profile/ActivePositions";
import { VerifiedCallsSection } from "@/components/agents/profile/VerifiedCallsSection";
import { enrichActive, enrichResolved, groupActivePositionsByHorizon } from "@/components/positions/positionEnrichment";
import { OpenPositionsEmptyState } from "@/components/positions/PositionsLedgerEmptyState";
import { PositionHorizonSections } from "@/components/positions/PositionHorizonSections";
import { ReceiptCard } from "@/components/positions/ReceiptCard";
import type { PositionsPayload } from "@/components/positions/types";
import { countActivePositions } from "@/lib/activePositions";
import {
  countResolvedReceipts,
  hasEnrichedReceipts,
  hasPositionList,
  hasResolvedPositionsLedger,
} from "@/lib/profileSectionState";
import { ResolvedScryReceiptList } from "./ResolvedScryReceiptList";
import { getProfileScryReceipts } from "./reputation/receiptData";
import type { EnrichedUserProfile } from "./types";

export function UserProfilePositionsTab({
  profile,
  positions,
  loading,
}: {
  profile: EnrichedUserProfile;
  positions: PositionsPayload | null;
  loading: boolean;
}) {
  const enrichedActive = (positions?.active_positions ?? []).map(enrichActive);
  const enrichedResolved = (positions?.resolved_positions ?? []).map(enrichResolved);
  const activeByHorizon = groupActivePositionsByHorizon(enrichedActive);
  const activeCount = countActivePositions(positions, profile.positions.length);
  const showPositionList = hasPositionList(positions, profile.positions.length);
  const receipts = useMemo(
    () => getProfileScryReceipts(profile, positions),
    [profile, positions],
  );
  const hasLedgerResolved = hasResolvedPositionsLedger(positions);
  const hasScryResolved = countResolvedReceipts(receipts) > 0;
  const hasEnriched = hasEnrichedReceipts(profile);
  const hasResolvedProof = hasLedgerResolved || hasScryResolved || hasEnriched;

  return (
    <div className="space-y-4">
      <section>
        <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Open positions
          </p>
          <Link href="/me/positions" className="text-[10px] text-violet-400 hover:text-violet-300">
            Positions hub →
          </Link>
        </div>
        {loading && (
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-8 animate-pulse h-24" />
        )}
        {!loading && showPositionList && (
          enrichedActive.length > 0 ? (
            <PositionHorizonSections groups={activeByHorizon} />
          ) : (
            <ActivePositions profile={profile} />
          )
        )}
        {!loading && !showPositionList && (
          <OpenPositionsEmptyState compact activeCount={activeCount} />
        )}
      </section>

      <section>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2 px-0.5">
          Resolved calls
        </p>
        {loading && (
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-8 animate-pulse h-24" />
        )}
        {!loading && hasLedgerResolved && (
          <div className="space-y-2">
            {enrichedResolved.map((p) => (
              <ReceiptCard key={p.id} position={p} />
            ))}
          </div>
        )}
        {!loading && !hasLedgerResolved && hasEnriched && (
          <VerifiedCallsSection profile={profile} />
        )}
        {!loading && !hasLedgerResolved && !hasEnriched && hasScryResolved && (
          <ResolvedScryReceiptList receipts={receipts} />
        )}
        {!loading && !hasResolvedProof && (
          <div className="rounded-xl border border-dashed border-zinc-800/80 bg-zinc-950/40 p-6 text-center">
            <p className="text-sm font-medium text-zinc-300">No resolved calls yet</p>
            <p className="text-[11px] text-zinc-500 mt-1.5 max-w-sm mx-auto">
              Resolved positions and receipts appear here after markets settle.
            </p>
            <Link
              href="/markets"
              className="inline-block mt-3 text-[11px] font-medium text-violet-300 hover:text-violet-200"
            >
              Browse markets →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
