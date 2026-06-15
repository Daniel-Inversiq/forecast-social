"use client";

import { useMemo } from "react";
import { PanelShell } from "@/components/feed/shared";
import type { PositionsPayload } from "@/components/positions/types";
import { UserRecentActivityList } from "./UserRecentActivityList";
import type { EnrichedUserProfile } from "./types";
import type { ScryReceipt } from "./reputation/types";
import { buildUserRecentActivity } from "./userRecentActivity";

export function ProfileRecentActivitySection({
  profile,
  positions = null,
  scryReceipts = [],
  variant = "feed",
  wrapSidebar = false,
}: {
  profile: EnrichedUserProfile;
  positions?: PositionsPayload | null;
  scryReceipts?: ScryReceipt[];
  variant?: "sidebar" | "feed";
  /** Wrap sidebar variant in PanelShell (returns null when no activity). */
  wrapSidebar?: boolean;
}) {
  const items = useMemo(
    () => buildUserRecentActivity(profile, positions, scryReceipts),
    [profile, positions, scryReceipts],
  );

  if (items.length === 0) {
    return null;
  }

  const list = (
    <UserRecentActivityList
      profile={profile}
      positions={positions}
      scryReceipts={scryReceipts}
      variant={variant}
    />
  );

  if (variant === "sidebar" && wrapSidebar) {
    return (
      <PanelShell
        title="Your Recent Activity"
        subtitle="Your follows, battles, and on-record moves"
        headerClass="!py-1.5"
      >
        {list}
      </PanelShell>
    );
  }

  if (variant === "feed") {
    return (
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2 px-0.5">
          Recent activity
        </p>
        {list}
      </div>
    );
  }

  return list;
}
