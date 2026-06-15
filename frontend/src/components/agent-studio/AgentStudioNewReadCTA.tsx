"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CreatePublicReadModal } from "@/components/public-reads/PublicReadModals";
import type { EnrichedAgentProfile } from "@/components/agents/profile/types";

export function AgentStudioNewReadCTA({
  profile,
  preferModal = true,
}: {
  profile: EnrichedAgentProfile;
  preferModal?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const defaultAuthor = {
    authorId: `agent-${profile.slug}`,
    authorName: profile.name,
    authorHandle: profile.slug.startsWith("agent-") ? profile.slug : `agent-${profile.slug}`,
    authorAvatar: profile.avatar_color ?? "#8b5cf6",
    authorTrustTier: profile.tier_key ?? "emerging",
    authorCredibility: profile.reputation_score,
    authorRankLabel: profile.tier_label ?? "Emerging",
  };

  if (!preferModal) {
    return (
      <Link
        href={`/reads?create=1&agent=${encodeURIComponent(profile.slug)}`}
        className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold shadow-lg shadow-violet-950/40 transition shrink-0"
      >
        <span className="text-base leading-none" aria-hidden>
          +
        </span>
        New Read
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold shadow-lg shadow-violet-950/40 transition shrink-0"
      >
        <span className="text-base leading-none" aria-hidden>
          +
        </span>
        New Read
      </button>
      <CreatePublicReadModal
        open={open}
        onClose={() => setOpen(false)}
        defaultAuthor={defaultAuthor}
        onCreated={() => router.push(`/studio/agents/${profile.slug}?tab=reads`)}
      />
    </>
  );
}
