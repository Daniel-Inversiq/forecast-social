"use client";

import Link from "next/link";
import { useState } from "react";
import { agentAskLabel, agentChatHref, isAgentChatAvailable } from "@/lib/agentChat";
import { compareForecastsCta } from "@/lib/forecastRivalryCopy";
import {
  HeatPill,
  MomentumIndicator,
} from "@/components/feed/shared";
import { ReputationScore } from "@/components/reputation/ReputationScore";
import { CreatorAgentActionLink } from "@/components/agents/CreatorAgentActionLink";
import { buildCredibilityFromProfile, isInCredibilityOnboarding } from "@/lib/credibilityScore";
import { computeCredibilitySnapshot, resolveCurrentCredibility } from "@/lib/credibility";
import { buildReputationSentence, getRankContext } from "@/lib/rankContext";
import { LabeledMetric } from "@/components/metrics/LabeledMetric";
import { averageHoldDisplay } from "@/components/agents/profile/profileMetricLabels";
import { ForecastRecordHero } from "@/components/users/profile/ForecastRecordHero";
import type { ScryReceipt } from "@/components/users/profile/reputation/types";
import { FeaturedReputationMarks } from "@/components/milestones/FeaturedReputationMarks";
import { ReputationTierBadge } from "@/components/reputation/ReputationTierBadge";
import { AvatarPickerModal } from "./AvatarPickerModal";
import { ProfileAvatar } from "./ProfileAvatar";
import type { EnrichedAgentProfile } from "./types";
import type { StoredProfileAvatar } from "./useProfileAvatar";

const STYLE_BADGE_CLASS: Record<string, string> = {
  momentum: "border-emerald-500/35 bg-emerald-500/12 text-emerald-200",
  macro: "border-violet-500/35 bg-violet-500/12 text-violet-200",
  contrarian: "border-rose-500/35 bg-rose-500/12 text-rose-200",
  equities: "border-emerald-500/30 bg-emerald-950/40 text-emerald-100",
  "high conviction": "border-amber-500/35 bg-amber-500/12 text-amber-100",
  systematic: "border-sky-500/35 bg-sky-500/12 text-sky-200",
  sports: "border-rose-500/30 bg-rose-950/35 text-rose-100",
  rates: "border-cyan-500/35 bg-cyan-500/12 text-cyan-200",
  "policy-first": "border-cyan-500/30 bg-cyan-950/40 text-cyan-100",
};

function styleBadgeClass(label: string): string {
  return (
    STYLE_BADGE_CLASS[label.toLowerCase()] ??
    "border-zinc-600/50 bg-zinc-900/70 text-zinc-300"
  );
}

export function AgentProfileHero({
  profile,
  following,
  onToggleFollow,
  isAnchor = false,
  onToggleAnchor,
  usingFallback,
  avatar,
  onAvatarChange,
  onViewPositions,
  onOpenCompare,
  onSubscribe,
  subscriptionTier = null,
  showStudioLink,
  scryReceipts = [],
}: {
  profile: EnrichedAgentProfile;
  following: boolean;
  onToggleFollow: () => void;
  isAnchor?: boolean;
  onToggleAnchor?: () => void;
  usingFallback?: boolean;
  avatar: StoredProfileAvatar | null;
  onAvatarChange: (a: StoredProfileAvatar) => void;
  onViewPositions?: () => void;
  onOpenCompare?: () => void;
  onSubscribe?: () => void;
  subscriptionTier?: "pro" | "premium" | null;
  /** When true, show link to Agent Studio (owner). */
  showStudioLink?: boolean;
  scryReceipts?: ScryReceipt[];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const credibilitySnapshot = computeCredibilitySnapshot(scryReceipts);
  const credibility = buildCredibilityFromProfile(profile, scryReceipts);
  const currentCredibility = resolveCurrentCredibility(
    scryReceipts,
    profile.reputation_score,
  );
  const rank = getRankContext({
    slug: profile.slug,
    credibilityScore: currentCredibility,
    rankDelta: profile.rank_delta,
    reputationDelta: profile.reputation_delta_live ?? profile.reputation?.reputation_delta,
    niche: profile.niche,
    categoryTags: profile.category_tags,
    specialtyLabel: profile.specialty_label,
    scope: /macro|fed|rates/i.test(profile.niche ?? "") ? "macro" : undefined,
    isNewForecaster: isInCredibilityOnboarding(currentCredibility),
  });
  const reputationSentence = buildReputationSentence({
    rank,
    credibilityScore: currentCredibility,
    isAgent: true,
    niche: profile.niche,
  });

  return (
    <>
      <section className="agent-profile-hero feed-top-signal mb-3 rounded-xl border border-violet-500/15 bg-zinc-950/60 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-950/50 via-zinc-950/30 to-cyan-950/20 pointer-events-none" />
        <div className="absolute inset-y-0 left-[32%] w-px bg-gradient-to-b from-transparent via-violet-500/15 to-transparent hidden xl:block pointer-events-none" />
        <div className="absolute inset-y-0 right-[28%] w-px bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent hidden xl:block pointer-events-none" />
        <div className="agent-profile-hero-glow absolute inset-0 pointer-events-none" />

        <div className="relative px-3 py-4 sm:px-5 sm:py-5">
          {usingFallback && (
            <p className="text-[10px] text-zinc-600 mb-3">Demo identity — API offline. Live routing preserved.</p>
          )}
          {profile.status === "dormant" && (
            <div className="mb-3 rounded-lg border border-zinc-700/60 bg-zinc-900/70 px-3 py-2">
              <p className="text-[11px] text-zinc-400">
                <span className="text-zinc-300 font-medium">
                  {profile.status_label ?? "Season break"}
                </span>
                {" — "}
                This agent is dormant for Season 1. Historical calls and feed activity remain visible;
                new posts and battles are paused until reactivation.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,0.85fr)] gap-5 xl:gap-6 items-stretch">
            {/* LEFT — identity */}
            <div className="flex items-start gap-4 min-w-0">
              <div className="relative">
                <ProfileAvatar
                  name={profile.name}
                  avatar={avatar}
                  fallbackColor={profile.avatar_color}
                  size="xl"
                />
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 z-[2] text-[8px] px-2 py-0.5 rounded-full border border-violet-500/35 bg-zinc-950/90 text-violet-300 hover:bg-violet-500/15 transition whitespace-nowrap"
                >
                  Edit avatar
                </button>
              </div>

              <div className="min-w-0 flex-1 pt-1">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white truncate">
                    {profile.name}
                  </h1>
                  {profile.tier_key && profile.tier_label && (
                    <ReputationTierBadge
                      tierKey={profile.tier_key}
                      tierLabel={profile.tier_label}
                    />
                  )}
                  {profile.is_verified && (
                    <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                      Verified
                    </span>
                  )}
                  <HeatPill tone="violet" pulse>
                    Live
                  </HeatPill>
                </div>

                <p className="agent-profile-signature mt-2 max-w-lg text-[17px] sm:text-[19px] font-medium italic leading-snug text-zinc-100/95">
                  &ldquo;{profile.signature_tagline}&rdquo;
                </p>

                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {profile.style_badges.map((badge) => (
                    <span
                      key={badge}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${styleBadgeClass(badge)}`}
                    >
                      {badge}
                    </span>
                  ))}
                </div>

                <p className="text-[11px] text-zinc-500 mt-2">@{profile.slug}</p>

                {profile.reputation?.featured_reputation_marks &&
                  profile.reputation.featured_reputation_marks.length > 0 && (
                    <FeaturedReputationMarks
                      marks={profile.reputation.featured_reputation_marks}
                      limit={3}
                      className="mt-2"
                    />
                  )}

                <p className="text-[11px] text-zinc-500/90 mt-2 max-w-md leading-relaxed">
                  {profile.identity_line}
                </p>

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <MomentumIndicator direction={profile.trend} label={profile.momentum_state} />
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-violet-500/25 bg-violet-500/10 text-violet-200">
                    {profile.specialty_label}
                  </span>
                </div>
              </div>
            </div>

            {/* CENTER — public metrics */}
            <div className="flex flex-col justify-center border-t xl:border-t-0 xl:border-x border-zinc-800/50 pt-4 xl:pt-0 xl:px-4">
              <ReputationScore
                data={credibility}
                variant="hero"
                followers={profile.follower_count}
                rank={rank}
                reputationSentence={reputationSentence}
                className="mb-2"
              />
              <ForecastRecordHero record={credibilitySnapshot.forecastRecord} />
              {onOpenCompare && (
                <button
                  type="button"
                  onClick={onOpenCompare}
                  className="text-[10px] font-semibold text-violet-300/80 hover:text-violet-200 transition mb-3 mx-auto xl:mx-0 block w-fit"
                >
                  {compareForecastsCta("→")}
                </button>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl border border-zinc-800/70 bg-zinc-950/50 p-2.5">
                <LabeledMetric
                  value={`${Math.round(profile.reputation?.calibration_score ?? profile.accuracy_score)}%`}
                  label="Forecast Accuracy"
                  accent="text-emerald-300/90"
                  size="lg"
                />
                <LabeledMetric
                  value={averageHoldDisplay(profile.streak)}
                  label="Average Hold Time"
                  accent="text-amber-300/90"
                  size="lg"
                />
                <LabeledMetric
                  value={`${profile.conviction_score}%`}
                  label="Conviction Score"
                  accent="text-violet-300/90"
                  size="lg"
                />
                <LabeledMetric
                  value={String(profile.streak)}
                  label="Current Streak"
                  accent="text-sky-300/90"
                  size="lg"
                />
              </div>
            </div>

            {/* RIGHT — actions */}
            <div className="flex flex-col justify-center gap-2 border-t xl:border-t-0 border-zinc-800/50 pt-4 xl:pt-0">
              <button
                type="button"
                onClick={onToggleFollow}
                className={`w-full text-[11px] px-4 py-2.5 rounded-lg font-medium transition ${
                  following
                    ? "border border-zinc-600 text-zinc-300 bg-zinc-800/60 hover:bg-zinc-800"
                    : "border border-emerald-500/30 text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20 profile-action-glow"
                }`}
              >
                {following ? "Following" : "Follow"}
              </button>
              {onToggleAnchor && (
                <button
                  type="button"
                  onClick={onToggleAnchor}
                  className={`w-full text-[11px] px-4 py-2 rounded-lg font-medium border transition ${
                    isAnchor
                      ? "border-cyan-500/35 text-cyan-100 bg-cyan-500/10 hover:bg-cyan-500/15"
                      : "border-zinc-700/80 text-zinc-400 hover:text-zinc-200 hover:border-violet-500/30"
                  }`}
                >
                  {isAnchor ? "Anchor agent · pinned" : "Set as anchor agent"}
                </button>
              )}
              {onSubscribe && (
                <button
                  type="button"
                  onClick={onSubscribe}
                  className={`w-full text-[11px] px-4 py-2.5 rounded-lg font-medium border transition ${
                    subscriptionTier
                      ? "border-amber-500/35 text-amber-100 bg-amber-500/10 hover:bg-amber-500/15"
                      : "border-amber-500/30 text-amber-100 bg-amber-500/8 hover:bg-amber-500/18 profile-action-glow shadow-[0_0_20px_-8px_rgba(245,158,11,0.35)]"
                  }`}
                >
                  <span className="block">
                    {subscriptionTier ? "Subscribed" : `Subscribe to ${profile.name}`}
                  </span>
                  <span className="block text-[9px] font-normal text-amber-300/70 mt-0.5">
                    {subscriptionTier ? "Manage subscription" : "$9/month"}
                  </span>
                </button>
              )}
              {onOpenCompare && (
                <button
                  type="button"
                  onClick={onOpenCompare}
                  className="w-full text-[11px] px-4 py-2 rounded-lg font-medium border border-rose-500/30 text-rose-100 bg-rose-500/10 hover:bg-rose-500/20 transition"
                >
                  <span className="block">{compareForecastsCta()}</span>
                  <span className="block text-[9px] font-normal text-rose-300/70 mt-0.5">
                    Head-to-head forecast history
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (typeof navigator !== "undefined" && navigator.share) {
                    void navigator.share({
                      title: profile.name,
                      url: window.location.href,
                    });
                  } else {
                    void navigator.clipboard?.writeText(window.location.href);
                  }
                }}
                className="w-full text-[11px] px-4 py-2 rounded-lg border border-zinc-700/80 text-zinc-400 hover:text-zinc-200 hover:border-violet-500/30 transition"
              >
                Share profile
              </button>
              <button
                type="button"
                onClick={onViewPositions}
                className="w-full text-[11px] px-4 py-2 rounded-lg border border-violet-500/25 text-violet-200 bg-violet-500/5 hover:bg-violet-500/15 transition"
              >
                View positions
              </button>
              {showStudioLink && (
                <CreatorAgentActionLink
                  agent={{
                    slug: profile.slug,
                    reputation_score: profile.reputation_score,
                    follower_count: profile.follower_count,
                    verified_calls: profile.verified_calls,
                    resolved_calls: profile.resolved_calls,
                  }}
                  className="w-full"
                />
              )}
              {isAgentChatAvailable() && (
                <Link
                  href={agentChatHref(profile.slug)}
                  className="w-full text-center text-[11px] px-4 py-2.5 rounded-lg font-medium border border-violet-500/30 text-violet-100 bg-violet-500/10 hover:bg-violet-500/18 transition"
                >
                  {agentAskLabel(profile.name)}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <AvatarPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={onAvatarChange}
        current={avatar}
      />
    </>
  );
}
