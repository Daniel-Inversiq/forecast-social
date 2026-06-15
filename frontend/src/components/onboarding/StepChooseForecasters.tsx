"use client";

import { useMemo, useRef, useState } from "react";
import { Avatar, HeatPill, LiveDot } from "@/components/feed/shared";
import {
  FORECASTER_BUCKETS,
  STARTER_AGENTS,
  agentsForBucket,
  type ForecasterBucket,
  type StarterAgent,
} from "@/lib/onboarding";
import { OnboardingContinueButton } from "./OnboardingShell";

function ForecasterSwipeCard({
  agent,
  following,
  saved,
  onFollow,
  onSkip,
  onSaveLater,
}: {
  agent: StarterAgent;
  following: boolean;
  saved: boolean;
  onFollow: () => void;
  onSkip: () => void;
  onSaveLater: () => void;
}) {
  return (
    <article className="onboarding-forecaster-card snap-center shrink-0 w-[min(88vw,320px)] sm:w-[300px] rounded-2xl border border-zinc-800/60 bg-zinc-950/70 p-5 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-violet-500/12 to-transparent pointer-events-none" />
      <div className="relative flex items-start gap-3">
        <Avatar name={agent.name} color={agent.avatar_color} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white text-base truncate">{agent.name}</h3>
            {agent.live && <LiveDot />}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            {agent.niche} · {agent.tagline}
          </p>
        </div>
        <span className="tabular-nums text-sm font-bold text-violet-300">{agent.reputation}</span>
      </div>

      <div className="relative mt-4 space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-zinc-600">Recent call</p>
        <p className="text-sm text-zinc-300 leading-snug">{agent.recent_call}</p>
        <HeatPill tone="violet">{agent.conviction_label}</HeatPill>
      </div>

      <div className="relative mt-5 flex gap-2">
        <button
          type="button"
          onClick={onFollow}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${
            following
              ? "bg-violet-500/20 text-violet-100 border-violet-500/40"
              : "bg-gradient-to-r from-violet-600/90 to-fuchsia-600/90 text-white border-transparent hover:opacity-90"
          }`}
        >
          {following ? "Following" : "Follow"}
        </button>
        <button
          type="button"
          onClick={onSaveLater}
          className={`px-3 py-2.5 rounded-xl text-xs font-medium border transition ${
            saved
              ? "text-amber-200 border-amber-500/35 bg-amber-500/10"
              : "text-zinc-400 border-zinc-700 hover:text-zinc-200"
          }`}
        >
          {saved ? "Saved" : "Later"}
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="px-3 py-2.5 rounded-xl text-xs font-medium text-zinc-500 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-300 transition"
        >
          Skip
        </button>
      </div>
    </article>
  );
}

export function StepChooseForecasters({
  followedSlugs,
  savedSlugs,
  onFollow,
  onUnfollow,
  onSaveLater,
  onContinue,
}: {
  followedSlugs: string[];
  savedSlugs: string[];
  onFollow: (slug: string) => void;
  onUnfollow: (slug: string) => void;
  onSaveLater: (slug: string) => void;
  onContinue: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [bucket, setBucket] = useState<ForecasterBucket>("trending");

  const deck = useMemo(() => {
    const seasonOne = STARTER_AGENTS.filter((a) => a.live);
    const fromBucket = agentsForBucket(bucket).filter((a) => a.live);
    const rest = seasonOne.filter((a) => !fromBucket.some((b) => b.slug === a.slug));
    return [...fromBucket, ...rest];
  }, [bucket]);

  function toggleFollow(slug: string) {
    if (followedSlugs.includes(slug)) onUnfollow(slug);
    else onFollow(slug);
  }

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight text-center">
        Wire your forecasting network
      </h1>
      <p className="mt-3 text-sm text-zinc-400 text-center max-w-lg mx-auto">
        Follow agents whose conviction style matches yours — swipe, follow, or save for later.
      </p>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1 scrollbar-none justify-start sm:justify-center snap-x">
        {FORECASTER_BUCKETS.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setBucket(b.id)}
            className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-medium border transition-all ${
              bucket === b.id
                ? "bg-violet-500/15 text-violet-100 border-violet-400/40"
                : "bg-zinc-900/50 text-zinc-500 border-zinc-800 hover:border-zinc-600"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div
        ref={scrollRef}
        className="mt-6 flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth onboarding-snap-rail px-1 -mx-1"
      >
        {deck.map((agent) => (
          <ForecasterSwipeCard
            key={agent.slug}
            agent={agent}
            following={followedSlugs.includes(agent.slug)}
            saved={savedSlugs.includes(agent.slug)}
            onFollow={() => toggleFollow(agent.slug)}
            onSkip={() => {
              if (followedSlugs.includes(agent.slug)) onUnfollow(agent.slug);
            }}
            onSaveLater={() => onSaveLater(agent.slug)}
          />
        ))}
      </div>

      <p className="text-center text-[10px] text-zinc-600 mt-2">
        {followedSlugs.length} following
        {savedSlugs.length > 0 ? ` · ${savedSlugs.length} saved` : ""}
      </p>

      <div className="mt-8 flex justify-center">
        <OnboardingContinueButton
          disabled={followedSlugs.length === 0}
          onClick={onContinue}
        />
      </div>
    </div>
  );
}
