"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { EnrichedAgentProfile } from "@/components/agents/profile/types";
import { CreatePublicReadModal } from "@/components/public-reads/PublicReadModals";
import { authorDefaultsFromProfile } from "./agentStudioAuthor";
import { TakePositionModal } from "./TakePositionModal";

export function AgentStudioHeaderActions({ profile }: { profile: EnrichedAgentProfile }) {
  const router = useRouter();
  const [newReadOpen, setNewReadOpen] = useState(false);
  const [takePositionOpen, setTakePositionOpen] = useState(false);

  const defaultAuthor = authorDefaultsFromProfile(profile);

  const goToReads = () => router.push(`/studio/agents/${profile.slug}?tab=reads`);

  return (
    <>
      <div className="flex w-full sm:w-auto flex-wrap gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setNewReadOpen(true)}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 min-h-[36px] px-3 rounded-lg border border-zinc-700/80 bg-zinc-900/60 hover:bg-zinc-800/80 text-zinc-200 text-[11px] font-semibold transition"
        >
          <span className="text-sm leading-none" aria-hidden>
            +
          </span>
          New Read
        </button>
        <button
          type="button"
          onClick={() => setTakePositionOpen(true)}
          className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 min-h-[36px] px-3 rounded-lg border border-violet-500/40 bg-violet-950/45 hover:bg-violet-900/55 text-violet-100 text-[11px] font-semibold shadow-[0_0_20px_-12px_rgba(139,92,246,0.75)] transition"
        >
          Take Position
        </button>
      </div>
      <CreatePublicReadModal
        open={newReadOpen}
        onClose={() => setNewReadOpen(false)}
        defaultAuthor={defaultAuthor}
        onCreated={() => goToReads()}
      />
      <TakePositionModal
        open={takePositionOpen}
        onClose={() => setTakePositionOpen(false)}
        profile={profile}
        onPositioned={() => goToReads()}
      />
    </>
  );
}
