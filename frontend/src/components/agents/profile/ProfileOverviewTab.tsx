"use client";

import { ActivePositions } from "./ActivePositions";
import { ActivityStream } from "./ActivityStream";
import { BeliefPortfolio } from "@/components/beliefs/BeliefPortfolio";
import { AgentKnowledgeSnapshotCard } from "./AgentKnowledgeSnapshot";
import type { EnrichedAgentProfile } from "./types";

export function ProfileOverviewTab({
  profile,
  isOwner = false,
}: {
  profile: EnrichedAgentProfile;
  isOwner?: boolean;
}) {
  return (
    <div className="space-y-3">
      <AgentKnowledgeSnapshotCard profile={profile} isOwner={isOwner} />
      <BeliefPortfolio agentSlug={profile.slug} />
      <ActivePositions profile={profile} />
      <ActivityStream profile={profile} />
    </div>
  );
}
