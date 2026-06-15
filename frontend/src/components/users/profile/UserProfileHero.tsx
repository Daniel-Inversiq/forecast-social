"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { AvatarPickerModal } from "@/components/agents/profile/AvatarPickerModal";
import { ProfileAvatar } from "@/components/agents/profile/ProfileAvatar";
import type { StoredProfileAvatar } from "@/components/agents/profile/useProfileAvatar";
import { ProfileFocusAreas } from "@/components/profile/ProfileFocusAreas";
import { FeaturedReputationMarks } from "@/components/milestones/FeaturedReputationMarks";
import { WalletIdentityChip } from "@/components/wallet/WalletIdentityChip";
import type { PositionsPayload } from "@/components/positions/types";
import { computeCredibilitySnapshot, resolveCurrentCredibility } from "@/lib/credibility";
import { deriveProfileFocusAreas } from "@/lib/profileFocusAreas";
import { getRankContext } from "@/lib/rankContext";
import type { EnrichedUserProfile } from "./types";
import type { ScryReceipt } from "./reputation/types";

function formatCount(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

function HeroStat({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm sm:text-[15px] font-medium text-zinc-200 tabular-nums leading-snug">
      {children}
    </p>
  );
}

function SocialStat({ label, count }: { label: string; count: number }) {
  return (
    <p className="text-sm sm:text-[15px] text-zinc-400 tabular-nums leading-snug">
      {label}{" "}
      <span className="text-zinc-100 font-semibold">{formatCount(count)}</span>
    </p>
  );
}

export function UserProfileHero({
  profile,
  avatar,
  onAvatarChange,
  scryReceipts = [],
  positions = null,
}: {
  profile: EnrichedUserProfile;
  avatar: StoredProfileAvatar | null;
  onAvatarChange: (a: StoredProfileAvatar) => void;
  scryReceipts?: ScryReceipt[];
  positions?: PositionsPayload | null;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const marks = profile.reputation?.featured_reputation_marks ?? [];
  const credibilitySnapshot = computeCredibilitySnapshot(scryReceipts);
  const currentCredibility = resolveCurrentCredibility(
    scryReceipts,
    profile.reputation_score,
  );
  const rank = getRankContext({
    slug: profile.slug,
    credibilityScore: currentCredibility,
    rankDelta: profile.rank_delta,
    reputationDelta: profile.reputation_delta_live,
    niche: profile.niche,
    categoryTags: profile.category_tags,
    specialtyLabel: profile.specialty_label,
  });
  const winRate =
    credibilitySnapshot.forecastRecord.winRate ??
    profile.battle_win_rate ??
    profile.reputation?.battle_win_rate ??
    null;

  const focusAreas = useMemo(
    () =>
      positions
        ? deriveProfileFocusAreas(profile, positions)
        : profile.focus_areas.length > 0
          ? profile.focus_areas
          : deriveProfileFocusAreas(profile),
    [profile, positions],
  );

  return (
    <>
      <section className="agent-profile-hero feed-top-signal mb-3 rounded-xl border border-violet-500/15 bg-zinc-950/60 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-950/40 via-zinc-950/30 to-cyan-950/15 pointer-events-none" />
        <div className="agent-profile-hero-glow absolute inset-0 pointer-events-none" />

        <div className="relative px-4 py-6 sm:px-6 sm:py-7 flex flex-col items-center text-center max-w-lg mx-auto">
          <div className="relative mb-4">
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

          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            {profile.name}
          </h1>

          <p className="text-[13px] sm:text-sm text-zinc-400 mt-2 max-w-md leading-relaxed">
            {profile.identity_line}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-4 w-full">
            <HeroStat>{currentCredibility} Credibility</HeroStat>
            {rank && <HeroStat>#{rank.rank} Rank</HeroStat>}
            <HeroStat>
              {winRate != null ? `${winRate}% Win Rate` : "Win rate building"}
            </HeroStat>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-2.5 w-full">
            <SocialStat label="Following" count={profile.following_count} />
            <SocialStat label="Followers" count={profile.follower_count} />
          </div>

          {focusAreas.length > 0 && (
            <ProfileFocusAreas areas={focusAreas} className="mt-4 w-full" />
          )}

          {(profile.wallet_verified || profile.ens_name || profile.wallet_address) && (
            <div className="mt-3 flex justify-center">
              <WalletIdentityChip
                identity={{
                  username: profile.slug,
                  ens_name: profile.ens_name,
                  wallet_address: profile.wallet_address,
                  wallet_address_short: profile.wallet_address_short,
                  wallet_chain: profile.wallet_chain,
                  wallet_chain_label: profile.wallet_chain_label,
                  wallet_verified: profile.wallet_verified,
                }}
              />
            </div>
          )}

          {marks.length > 0 && (
            <FeaturedReputationMarks marks={marks} limit={3} className="mt-3 justify-center" />
          )}

          <div className="flex flex-col sm:flex-row gap-2 mt-5 w-full max-w-xs sm:max-w-sm">
            <button
              type="button"
              onClick={() => {
                if (typeof navigator !== "undefined" && navigator.share) {
                  void navigator.share({
                    title: `${profile.name} · Scry`,
                    url: window.location.href,
                  });
                } else {
                  void navigator.clipboard?.writeText(window.location.href);
                }
              }}
              className="flex-1 text-[11px] px-4 py-2.5 rounded-lg font-medium border border-violet-500/30 text-violet-200 bg-violet-500/10 hover:bg-violet-500/20 transition"
            >
              Share profile
            </button>
            <Link
              href="/settings"
              className="flex-1 text-center text-[11px] px-4 py-2.5 rounded-lg font-medium border border-zinc-700/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition"
            >
              Settings
            </Link>
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
