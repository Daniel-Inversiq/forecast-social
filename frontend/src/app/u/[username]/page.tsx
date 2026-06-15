"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { AgentProfile } from "@/components/agents/profile/types";
import { AgentProfileSidebar } from "@/components/agents/profile/AgentProfileSidebar";
import { useProfileAvatar } from "@/components/agents/profile/useProfileAvatar";
import { FeedShell } from "@/components/feed/FeedShell";
import { HeatPill, LiveDot } from "@/components/feed/shared";
import type { PositionsPayload } from "@/components/positions/types";
import { enrichUserProfile } from "@/components/users/profile/enrichUserProfile";
import type { EnrichedUserProfile, UserProfileTabKey, UserPublicProfile } from "@/components/users/profile/types";
import { UserProfileFollowingTab } from "@/components/users/profile/UserProfileFollowingTab";
import { UserProfileHero } from "@/components/users/profile/UserProfileHero";
import { UserProfileOverviewTab } from "@/components/users/profile/UserProfileOverviewTab";
import { UserProfilePositionsTab } from "@/components/users/profile/UserProfilePositionsTab";
import { UserProfileReputationTab } from "@/components/users/profile/UserProfileReputationTab";
import { ProfilePublicReadsSection } from "@/components/public-reads/ProfilePublicReadsSection";
import { UserProfileTabs } from "@/components/users/profile/UserProfileTabs";
import { useAuth } from "@/context/AuthProvider";
import { apiFetch } from "@/lib/api";
import { fetchAgentReputation } from "@/lib/reputation";
import { mergeAgentProfileWithReputation } from "@/components/agents/profile/mergeReputation";
import { useSettings } from "@/lib/settings/useSettings";
import type { ReputationMark } from "@/lib/reputation";
import { dispatchFeaturedMarksUpdated } from "@/lib/useUserFeaturedMarks";
import { ProfileReputationProof } from "@/components/users/profile/reputation/ProfileReputationProof";
import { getProfileScryReceipts } from "@/components/users/profile/reputation/receiptData";

export default function UserProfilePage() {
  const params = useParams();
  const username = typeof params.username === "string" ? params.username.toLowerCase() : "";
  const { user, loading: authLoading } = useAuth();
  const [publicProfile, setPublicProfile] = useState<UserPublicProfile | null>(null);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [positions, setPositions] = useState<PositionsPayload | null>(null);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<UserProfileTabKey>("overview");
  const [followingCount, setFollowingCount] = useState(0);

  const isOwnProfile = user?.username === username;

  const settingsState = useSettings(isOwnProfile ? user : null);
  const { avatar, setAvatar } = useProfileAvatar(username, user?.avatar_color ?? undefined);

  useEffect(() => {
    if (!isOwnProfile || !user) {
      setPositions(null);
      return;
    }

    let cancelled = false;
    async function loadPositions() {
      setPositionsLoading(true);
      try {
        const res = await apiFetch("/me/positions");
        if (!res.ok || cancelled) return;
        setPositions((await res.json()) as PositionsPayload);
      } catch {
        if (!cancelled) setPositions(null);
      } finally {
        if (!cancelled) setPositionsLoading(false);
      }
    }

    loadPositions();
    return () => {
      cancelled = true;
    };
  }, [isOwnProfile, user]);

  useEffect(() => {
    if (!isOwnProfile || !user) {
      setPublicProfile(null);
      setAgentProfile(null);
      setProfileLoading(false);
      return;
    }

    let cancelled = false;
    async function loadProfile() {
      setProfileLoading(true);
      try {
        const pubRes = await apiFetch(`/users/${encodeURIComponent(username)}`, {}, false);
        let pub: UserPublicProfile | null = null;
        if (pubRes.ok) {
          pub = (await pubRes.json()) as UserPublicProfile;
          if (!cancelled) setPublicProfile(pub);
        }

        const agentSlug = pub?.agent_slug ?? username;
        const agentRes = await apiFetch(`/agents/${encodeURIComponent(agentSlug)}`, {}, false);
        const reputation =
          agentRes.ok || pub?.agent_slug
            ? await fetchAgentReputation(agentSlug)
            : null;

        if (agentRes.ok && !cancelled) {
          let base = (await agentRes.json()) as AgentProfile;
          if (reputation) {
            base = mergeAgentProfileWithReputation(base, reputation);
          }
          setAgentProfile(base);
        } else if (!cancelled) {
          setAgentProfile(null);
        }

        const feedRes = await apiFetch("/following/feed");
        if (feedRes.ok && !cancelled) {
          const feed = await feedRes.json();
          setFollowingCount(feed?.followed_agents?.length ?? 0);
        }
      } catch {
        if (!cancelled) {
          setPublicProfile(null);
          setAgentProfile(null);
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [isOwnProfile, user, username]);

  const enriched: EnrichedUserProfile | null = useMemo(() => {
    if (!user || !isOwnProfile) return null;
    return enrichUserProfile({
      user,
      settings: settingsState.settings,
      positions,
      publicProfile,
      agentProfile,
      agentReputation: null,
    });
  }, [user, isOwnProfile, settingsState.settings, positions, publicProfile, agentProfile]);

  const scryReceipts = useMemo(() => {
    if (!enriched) return [];
    return getProfileScryReceipts(enriched, positions);
  }, [enriched, positions]);

  function handleFeaturedMarksUpdated(keys: string[], marks: ReputationMark[]) {
    const patch = {
      featured_milestone_keys: keys,
      featured_reputation_marks: marks,
    };
    setAgentProfile((p) => {
      if (!p?.reputation) return p;
      return { ...p, reputation: { ...p.reputation, ...patch } };
    });
    setPublicProfile((p) => (p ? { ...p, ...patch } : p));
    dispatchFeaturedMarksUpdated();
  }

  if (!username) {
    return (
      <FeedShell activeNav="Profile" hideCategoryNav>
        <p className="text-zinc-500 text-sm py-16 text-center">Invalid profile.</p>
      </FeedShell>
    );
  }

  if (authLoading) {
    return (
      <FeedShell activeNav="Profile" hideCategoryNav>
        <div className="max-w-lg mx-auto py-16 flex justify-center">
          <div className="h-8 w-48 rounded-lg bg-zinc-800/60 animate-pulse" />
        </div>
      </FeedShell>
    );
  }

  if (!user) {
    return (
      <FeedShell activeNav="Profile" hideCategoryNav>
        <div className="max-w-lg mx-auto py-16 text-center space-y-4">
          <p className="text-zinc-400 text-sm">Sign in to view your forecasting identity.</p>
          <Link
            href={`/login?next=${encodeURIComponent(`/u/${username}`)}`}
            className="inline-flex text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 px-4 py-2 rounded-xl transition"
          >
            Sign in
          </Link>
        </div>
      </FeedShell>
    );
  }

  if (!isOwnProfile) {
    return (
      <FeedShell activeNav="Profile" hideCategoryNav>
        <div className="max-w-lg mx-auto py-16 text-center space-y-3">
          <p className="text-zinc-300 text-sm">@{username} is not your account.</p>
          <p className="text-zinc-600 text-xs">
            Human forecaster profiles are private in this demo. Agent identities live in the{" "}
            <Link href="/agents" className="text-violet-400 hover:text-violet-300">
              agent directory
            </Link>
            .
          </p>
          <Link
            href={`/u/${user.username}`}
            className="inline-block text-sm text-violet-400 hover:text-violet-300"
          >
            Go to your profile →
          </Link>
        </div>
      </FeedShell>
    );
  }

  const tabCounts = {
    positions: positions?.stats.active_count ?? enriched?.positions.length ?? 0,
    following: followingCount,
  };

  const loading = profileLoading || !enriched;

  return (
    <FeedShell activeNav="Profile" hideCategoryNav>
      <div className="flex flex-wrap items-center gap-2 mb-3 px-0.5 min-w-0">
        <LiveDot />
        <p className="text-[11px] text-zinc-500 min-w-0 truncate">
          Public forecasting identity · reputation graph · conviction archive
        </p>
        <HeatPill tone="violet" pulse>
          Live
        </HeatPill>
        {enriched?.has_live_reputation && !loading && (
          <span className="text-[10px] text-emerald-500/90 border border-emerald-500/20 px-2 py-0.5 rounded-full bg-emerald-500/5">
            Live reputation
          </span>
        )}
        {enriched?.agent_linked && !loading && (
          <span className="text-[10px] text-cyan-500/80 border border-cyan-500/20 px-2 py-0.5 rounded-full">
            Agent-linked identity
          </span>
        )}
      </div>

      {loading && (
        <div className="py-16 flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-violet-500/30 border-t-violet-400 animate-spin" />
          <p className="text-zinc-500 text-sm">Loading forecasting identity…</p>
        </div>
      )}

      {!loading && enriched && (
        <>
          <section className="feed-top-signal mb-3 space-y-0">
            <UserProfileHero
              profile={enriched}
              avatar={avatar}
              onAvatarChange={setAvatar}
              scryReceipts={scryReceipts}
              positions={positions}
            />
            <ProfileReputationProof profile={enriched} positions={positions} />
          </section>

          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px] lg:gap-4 xl:gap-5 lg:items-start pb-2">
            <main className="min-w-0">
              <UserProfileTabs active={activeTab} onChange={setActiveTab} counts={tabCounts} />

              {activeTab === "overview" && (
                <UserProfileOverviewTab profile={enriched} positions={positions} />
              )}
              {activeTab === "reads" && (
                <ProfilePublicReadsSection
                  authorIdOrHandle={enriched.slug ?? username}
                  authorName={enriched.name}
                />
              )}
              {activeTab === "positions" && (
                <UserProfilePositionsTab
                  profile={enriched}
                  positions={positions}
                  loading={positionsLoading}
                />
              )}
              {activeTab === "reputation" && (
                <UserProfileReputationTab
                  profile={enriched}
                  onFeaturedMarksUpdated={handleFeaturedMarksUpdated}
                />
              )}
              {activeTab === "following" && <UserProfileFollowingTab />}
            </main>

            <AgentProfileSidebar
              profile={enriched}
              scryReceipts={scryReceipts}
              positions={positions}
            />
          </div>
        </>
      )}
    </FeedShell>
  );
}
