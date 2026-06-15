"use client";

import Link from "next/link";
import { Avatar } from "@/components/feed/shared";
import { agentSlugFromName } from "@/lib/slugs";
import {
  consensusDelta,
  formatAuthorIdentityLine,
  formatOnRecordTimestamp,
  getConvictionLevel,
  estimateCredibilityImpact,
} from "./publicReadEnrichment";
import type { PublicRead } from "./types";

export function publicReadAuthorHref(read: PublicRead): string {
  if (read.authorHandle.startsWith("agent-")) {
    return `/agents/${read.authorHandle.replace(/^agent-/, "")}`;
  }
  if (read.authorId.startsWith("agent-")) {
    return `/agents/${agentSlugFromName(read.authorName)}`;
  }
  return `/agents/${read.authorHandle}`;
}

export function PublicReadAuthorBlock({
  read,
  compact = false,
  showHandle = true,
}: {
  read: PublicRead;
  compact?: boolean;
  showHandle?: boolean;
}) {
  const href = publicReadAuthorHref(read);

  return (
    <div className="flex gap-2.5">
      <Link href={href} className="shrink-0">
        <Avatar name={read.authorName} color={read.authorAvatar} size={compact ? "sm" : "md"} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={href}
          className={`block font-bold text-zinc-50 hover:text-violet-100 transition truncate ${
            compact ? "text-sm" : "text-base sm:text-lg"
          }`}
        >
          {read.authorName}
        </Link>
        <p
          className={`font-medium text-violet-200/90 tabular-nums ${
            compact ? "text-[10px]" : "text-[11px] sm:text-xs"
          }`}
        >
          {formatAuthorIdentityLine(read)}
        </p>
        <p className="text-[10px] text-zinc-500 mt-0.5">
          {formatOnRecordTimestamp(read.createdAt)}
          {showHandle && (
            <>
              {" "}
              · <span className="text-zinc-600">@{read.authorHandle}</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export function PublicReadProbabilityBlock({
  read,
  compact = false,
}: {
  read: PublicRead;
  compact?: boolean;
}) {
  const sideTone = read.side === "YES" ? "text-emerald-300" : "text-rose-300";
  const conviction = getConvictionLevel(read.probability);

  return (
    <div>
      <p className={`font-bold tabular-nums leading-none ${sideTone} ${compact ? "text-lg" : "text-xl sm:text-2xl"}`}>
        {read.probability}% <span className={compact ? "text-sm" : "text-base sm:text-lg"}>{read.side}</span>
      </p>
      {conviction && (
        <p className={`mt-1 font-medium ${conviction.toneClass} ${compact ? "text-[10px]" : "text-xs"}`}>
          {conviction.label}
        </p>
      )}
    </div>
  );
}

export function PublicReadConsensusBlock({
  read,
  compact = false,
}: {
  read: PublicRead;
  compact?: boolean;
}) {
  const delta = consensusDelta(read);

  return (
    <div className={compact ? "text-[10px]" : "text-[11px]"}>
      <span className="text-[9px] uppercase tracking-wider text-zinc-600 block">Consensus movement</span>
      <span className="tabular-nums text-zinc-300">
        {read.consensusAtPost}% at post → {read.currentConsensus}% now
      </span>
      {delta !== 0 && (
        <span
          className={`ml-1 text-[10px] font-semibold ${delta > 0 ? "text-emerald-400" : "text-rose-400"}`}
        >
          ({delta > 0 ? "+" : ""}
          {delta}pt)
        </span>
      )}
    </div>
  );
}

export function PublicReadPotentialImpact({
  read,
  compact = false,
}: {
  read: PublicRead;
  compact?: boolean;
}) {
  const { gain, loss } = estimateCredibilityImpact(read);

  return (
    <div
      className={`rounded-lg border border-zinc-800/80 bg-zinc-900/35 ${
        compact ? "px-2 py-1.5" : "px-2.5 py-2"
      }`}
    >
      <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-1">Potential impact</p>
      <div className={`flex flex-wrap gap-x-3 gap-y-0.5 tabular-nums font-medium ${compact ? "text-[10px]" : "text-[11px]"}`}>
        <span className="text-emerald-400/95">+{gain} if correct</span>
        <span className="text-rose-400/90">−{loss} if wrong</span>
      </div>
    </div>
  );
}

export function PublicReadActionBar({
  read,
  resolved,
  following,
  onBack,
  onChallenge,
  onFollowToggle,
  compact = false,
}: {
  read: PublicRead;
  resolved: boolean;
  following: boolean;
  onBack: () => void;
  onChallenge: () => void;
  onFollowToggle: () => void;
  compact?: boolean;
}) {
  if (resolved) return null;

  const primaryClass = compact
    ? "text-[10px] px-3 py-2 rounded-lg font-semibold"
    : "text-[11px] px-3.5 py-2.5 rounded-lg font-semibold";

  const secondaryClass = compact
    ? "text-[10px] px-2 py-1.5 rounded-lg"
    : "text-[10px] px-2.5 py-1.5 rounded-lg";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={read.userBacked}
          className={`scry-tap-target flex-1 sm:flex-none min-w-[7rem] border border-emerald-500/40 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25 shadow-[0_0_20px_-8px_rgba(16,185,129,0.35)] transition disabled:opacity-40 ${primaryClass}`}
        >
          {read.userBacked ? "Backed" : "Back This"}
        </button>
        <button
          type="button"
          onClick={onChallenge}
          disabled={read.userChallenged}
          className={`scry-tap-target flex-1 sm:flex-none min-w-[7rem] border border-rose-500/40 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25 shadow-[0_0_20px_-8px_rgba(244,63,94,0.3)] transition disabled:opacity-40 ${primaryClass}`}
        >
          {read.userChallenged ? "Challenged" : "Challenge"}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={onFollowToggle}
          className={`scry-tap-target border transition ${secondaryClass} ${
            following
              ? "border-violet-500/35 bg-violet-500/10 text-violet-300/90"
              : "border-zinc-800/90 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400"
          }`}
        >
          {following ? "Following" : "Follow"}
        </button>
        <Link
          href="/markets"
          className={`scry-tap-target border border-zinc-800/90 text-zinc-500 hover:text-zinc-400 hover:border-zinc-700 transition ${secondaryClass}`}
        >
          View Thread
        </Link>
      </div>
    </div>
  );
}
