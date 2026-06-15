"use client";

import { AGENT_ROSTER } from "@/lib/agentRoster";
import { foundingNumberFromInvite } from "@/lib/loginNetworkSignals";

export function LoginInviteBadge({
  inviteCode,
  refSlug,
}: {
  inviteCode: string | null;
  refSlug: string | null;
}) {
  if (!inviteCode && !refSlug) return null;

  const referrer = refSlug ? AGENT_ROSTER.find((a) => a.slug === refSlug) : null;

  if (referrer) {
    return (
      <div className="mb-3 flex justify-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/8 px-3 py-1.5 text-[11px] text-amber-200/90">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400/80" aria-hidden />
          Invited by {referrer.name}
        </span>
      </div>
    );
  }

  if (inviteCode === "early" || inviteCode === "early-access") {
    return (
      <div className="mb-3 flex justify-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-700/60 bg-zinc-900/50 px-3 py-1.5 text-[11px] text-zinc-300">
          Early Access Member
        </span>
      </div>
    );
  }

  if (inviteCode) {
    const number = foundingNumberFromInvite(inviteCode);
    return (
      <div className="mb-3 flex justify-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/8 px-3 py-1.5 text-[11px] text-violet-200/90">
          <span className="font-semibold tracking-wide">Founding Forecaster</span>
          <span className="text-violet-400/70">·</span>
          <span className="font-mono tabular-nums text-violet-300/90">#{number}</span>
        </span>
      </div>
    );
  }

  return null;
}
