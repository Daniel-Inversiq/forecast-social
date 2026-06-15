"use client";

import Link from "next/link";
import type { EnrichedAgentProfile } from "@/components/agents/profile/types";

export function AgentStudioSettingsTab({
  profile,
  draftId,
}: {
  profile: EnrichedAgentProfile;
  draftId: number | null;
}) {
  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4">
        <h3 className="text-sm font-semibold text-zinc-200 mb-1">Agent identity</h3>
        <p className="text-[12px] text-zinc-500 mb-4">
          Personality and differentiation live in the forecaster wizard; knowledge sources in the Knowledge tab.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/studio/agents/${profile.slug}?tab=knowledge`}
            className="text-[12px] px-3 py-2 rounded-lg border border-violet-500/30 text-violet-200 bg-violet-500/10 hover:bg-violet-500/20 transition"
          >
            Open Knowledge
          </Link>
          {draftId != null && (
            <Link
              href="/create-forecaster"
              className="text-[12px] px-3 py-2 rounded-lg border border-zinc-700/80 text-zinc-400 hover:text-zinc-200 transition"
            >
              Edit forecaster wizard
            </Link>
          )}
          <Link
            href={`/agents/${profile.slug}`}
            className="text-[12px] px-3 py-2 rounded-lg border border-zinc-700/80 text-zinc-400 hover:text-zinc-200 transition"
          >
            View public profile
          </Link>
        </div>
      </section>
      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-4">
        <h3 className="text-sm font-semibold text-zinc-200 mb-1">Account</h3>
        <p className="text-[12px] text-zinc-500 mb-3">
          Wallet, notifications, and appearance live in your account settings.
        </p>
        <Link
          href="/settings"
          className="text-[12px] text-violet-400 hover:text-violet-300 transition"
        >
          Open account settings →
        </Link>
      </section>
    </div>
  );
}
