"use client";

import { PanelShell } from "@/components/feed/shared";
import type { PositionsPayload } from "@/components/positions/types";
import { ProfileRecentActivitySection } from "./ProfileRecentActivitySection";
import type { EnrichedUserProfile } from "./types";
import type { ScryReceipt } from "./reputation/types";

export function YourRecentActivitySidebar({
  profile,
  positions = null,
  scryReceipts = [],
}: {
  profile: EnrichedUserProfile;
  positions?: PositionsPayload | null;
  scryReceipts?: ScryReceipt[];
}) {
  return (
    <ProfileRecentActivitySection
      profile={profile}
      positions={positions}
      scryReceipts={scryReceipts}
      variant="sidebar"
      wrapSidebar
    />
  );
}
