"use client";



import Link from "next/link";

import { useParams, useRouter } from "next/navigation";

import { useEffect, useMemo, useState } from "react";

import { FeedShell } from "@/components/feed/FeedShell";

import { HeatPill, LiveDot } from "@/components/feed/shared";

import { AgentProfileHero } from "@/components/agents/profile/AgentProfileHero";

import { AgentProfileSidebar } from "@/components/agents/profile/AgentProfileSidebar";

import { ProfileOverviewTab } from "@/components/agents/profile/ProfileOverviewTab";

import { buildFallbackProfile } from "@/components/agents/profile/fallbackData";

import { LiveReputationStrip } from "@/components/agents/profile/LiveReputationStrip";

import { ProfileDashboard } from "@/components/agents/profile/ProfileDashboard";

import { ProfileIntelligenceRow } from "@/components/agents/profile/ProfileIntelligenceRow";


import { ProfileTabs } from "@/components/agents/profile/ProfileTabs";

import { enrichAgentProfile } from "@/components/agents/profile/profileEnrichment";

import type { AgentProfile, ProfileTabKey } from "@/components/agents/profile/types";

import { useProfileAvatar } from "@/components/agents/profile/useProfileAvatar";

import { VerifiedCallsSection } from "@/components/agents/profile/VerifiedCallsSection";
import { ProfilePublicReadsSection } from "@/components/public-reads/ProfilePublicReadsSection";
import { RelatedIntelligence } from "@/components/discovery/RelatedIntelligence";

import { apiFetch } from "@/lib/api";
import { fetchAgentReputation } from "@/lib/reputation";
import { mergeAgentProfileWithReputation } from "@/components/agents/profile/mergeReputation";

import {
  fetchFollowStatus,
  followAgent,
  unfollowAgent,
} from "@/lib/agentFollow";
import {
  clearAnchorAgent,
  fetchAnchorStatus,
  setAnchorAgent,
} from "@/lib/anchorAgent";

import { useAuth } from "@/context/AuthProvider";
import { isAuthRequiredError, redirectToLogin } from "@/lib/authRedirect";
import { hasIntelligenceAccess } from "@/lib/intelligence";
import { AgentProfilePremiumBanner } from "@/components/intelligence/AgentProfilePremiumBanner";
import { CompareAgentModal } from "@/components/compare/CompareAgentModal";
import { ProfileRivalsSection } from "@/components/agents/profile/ProfileRivalsSection";
import type { ForecasterBase } from "@/components/agents/types";
import { API_BASE } from "@/lib/api";
import { rosterToFallbackAgents } from "@/lib/agentRoster";
import {
  comparePath,
  forecasterListToCompareOptions,
  getRecentCompareSlugs,
  getSuggestedRivals,
  pushRecentCompare,
} from "@/lib/compareAgents";
import { toUserProfileShape } from "@/components/compare/compareStats";
import { getProfileScryReceipts } from "@/components/users/profile/reputation/receiptData";
import { useForecasterSubscriptions } from "@/context/ForecasterSubscriptionsProvider";
import { ForecasterSubscribeModal } from "@/components/subscriptions/ForecasterSubscribeModal";
import { fetchStudioAgent } from "@/lib/agentStudio";



export default function AgentProfilePage() {

  const router = useRouter();
  const { user } = useAuth();

  const params = useParams();

  const slug = typeof params.slug === "string" ? params.slug : "";



  const [profile, setProfile] = useState<AgentProfile | null>(null);

  const [loading, setLoading] = useState(true);

  const [usingFallback, setUsingFallback] = useState(false);
  const [hasLiveReputation, setHasLiveReputation] = useState(false);

  const [following, setFollowing] = useState(false);
  const [isAnchor, setIsAnchor] = useState(false);

  const [activeTab, setActiveTab] = useState<ProfileTabKey>("overview");
  const [isOwner, setIsOwner] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [agentDirectory, setAgentDirectory] = useState<ForecasterBase[]>([]);
  const [recentCompareSlugs, setRecentCompareSlugs] = useState<string[]>([]);

  const { getTier } = useForecasterSubscriptions();
  const subscriptionTier = slug ? getTier(slug) : null;



  const enriched = useMemo(

    () => (profile ? enrichAgentProfile(profile) : null),

    [profile],

  );

  const scryReceipts = useMemo(() => {
    if (!enriched) return [];
    return getProfileScryReceipts(toUserProfileShape(enriched), null);
  }, [enriched]);



  const { avatar, setAvatar } = useProfileAvatar(slug, profile?.avatar_color);



  useEffect(() => {

    if (!slug) return;



    async function loadProfile() {
      setLoading(true);
      try {
        const [agentRes, reputation] = await Promise.all([
          apiFetch(`/agents/${encodeURIComponent(slug)}`, {}, false),
          fetchAgentReputation(slug),
        ]);

        let base: AgentProfile;
        if (agentRes.ok) {
          base = (await agentRes.json()) as AgentProfile;
          setUsingFallback(false);
        } else {
          base = buildFallbackProfile(slug);
          setUsingFallback(true);
        }

        setProfile(mergeAgentProfileWithReputation(base, reputation));
        setHasLiveReputation(reputation != null);
      } catch {
        setProfile(buildFallbackProfile(slug));
        setUsingFallback(true);
        setHasLiveReputation(false);
      } finally {
        setLoading(false);
      }
    }



    loadProfile();

  }, [slug]);



  useEffect(() => {

    if (!slug || loading || usingFallback) return;



    let cancelled = false;



    async function loadFollowStatus() {

      try {

        const [isFollowing, anchor] = await Promise.all([
          fetchFollowStatus(slug),
          fetchAnchorStatus(slug),
        ]);

        if (!cancelled) {
          setFollowing(isFollowing);
          setIsAnchor(anchor);
        }

      } catch {

        // keep default false when status cannot be loaded

      }

    }



    loadFollowStatus();

    return () => {

      cancelled = true;

    };

  }, [slug, loading, usingFallback]);

  useEffect(() => {
    if (!user || !slug) {
      setIsOwner(false);
      return;
    }
    let cancelled = false;
    fetchStudioAgent(slug)
      .then((studio) => {
        if (!cancelled) setIsOwner(studio.owner_user_id === user.id);
      })
      .catch(() => {
        if (!cancelled) setIsOwner(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, slug]);

  useEffect(() => {
    async function loadDirectory() {
      try {
        const res = await fetch(`${API_BASE}/agents`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setAgentDirectory(data as ForecasterBase[]);
            return;
          }
        }
      } catch {
        /* fallback */
      }
      setAgentDirectory(rosterToFallbackAgents());
    }
    loadDirectory();
  }, []);

  useEffect(() => {
    if (!slug) return;
    setRecentCompareSlugs(getRecentCompareSlugs(slug));
  }, [slug, compareOpen]);

  const compareOptions = useMemo(
    () => forecasterListToCompareOptions(agentDirectory),
    [agentDirectory],
  );

  const suggestedRivals = useMemo(
    () => (enriched ? getSuggestedRivals(enriched, agentDirectory) : []),
    [enriched, agentDirectory],
  );

  function navigateCompare(otherSlug: string) {
    pushRecentCompare(slug, otherSlug);
    setCompareOpen(false);
    router.push(comparePath(slug, otherSlug));
  }

  function handleRivalsCompare(rivalSlug?: string) {
    if (rivalSlug) navigateCompare(rivalSlug);
    else setCompareOpen(true);
  }

  async function toggleFollow() {

    const wasFollowing = following;

    setFollowing(!wasFollowing);



    if (usingFallback) return;



    try {

      if (wasFollowing) await unfollowAgent(slug);

      else await followAgent(slug);

    } catch (err) {

      if (isAuthRequiredError(err)) {

        redirectToLogin(router, `/agents/${slug}`);

        return;

      }

      setFollowing(wasFollowing);

    }

  }



  async function toggleAnchor() {
    if (usingFallback) return;
    const wasAnchor = isAnchor;
    setIsAnchor(!wasAnchor);
    try {
      if (wasAnchor) await clearAnchorAgent();
      else {
        const payload = await setAnchorAgent(slug);
        setIsAnchor(Boolean(payload.has_anchor));
        if (!following) setFollowing(true);
      }
    } catch (err) {
      if (isAuthRequiredError(err)) {
        redirectToLogin(router, `/agents/${slug}`);
        return;
      }
      setIsAnchor(wasAnchor);
    }
  }



  const tabCounts = enriched
    ? {
        positions: enriched.positions.length,
        receipts: enriched.enriched_receipts.length,
      }
    : { positions: 0, receipts: 0 };



  if (!slug) {

    return (

      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">

        <p className="text-zinc-500 text-sm">Invalid profile.</p>

      </div>

    );

  }



  return (

    <FeedShell

      activeNav="Agents"

      hideCategoryNav

      headerExtra={

        <div className="pb-2 border-b border-zinc-800/50 -mb-px">

          <Link

            href="/agents"

            className="text-[11px] text-zinc-500 hover:text-zinc-300 transition inline-flex items-center gap-1"

          >

            ← Agent directory

          </Link>

        </div>

      }

    >

      <div className="flex flex-wrap items-center gap-2 mb-3 px-0.5 min-w-0">

        <LiveDot />

        <p className="text-[11px] text-zinc-500 min-w-0 truncate">

          Public forecasting identity · reputation graph · live conviction intelligence

        </p>

        <HeatPill tone="violet" pulse>
          Realtime
        </HeatPill>
        {hasLiveReputation && !loading && (
          <span className="text-[10px] text-emerald-500/90 border border-emerald-500/20 px-2 py-0.5 rounded-full bg-emerald-500/5">
            Live reputation
          </span>
        )}
        {usingFallback && !loading && (
          <span className="text-[10px] text-zinc-600">Demo profile — API offline</span>
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

            <AgentProfileHero
              profile={enriched}
              following={following}
              onToggleFollow={toggleFollow}
              isAnchor={isAnchor}
              onToggleAnchor={toggleAnchor}
              usingFallback={usingFallback && !hasLiveReputation}
              avatar={avatar}
              onAvatarChange={setAvatar}
              onViewPositions={() => setActiveTab("overview")}
              onOpenCompare={() => setCompareOpen(true)}
              onSubscribe={isOwner ? undefined : () => setSubscribeOpen(true)}
              subscriptionTier={subscriptionTier}
              showStudioLink={isOwner}
              scryReceipts={scryReceipts}
            />

            <ForecasterSubscribeModal
              open={subscribeOpen}
              onClose={() => setSubscribeOpen(false)}
              forecasterId={slug}
              forecasterName={enriched.name}
            />

            <LiveReputationStrip profile={enriched} />

            <ProfileRivalsSection
              currentSlug={slug}
              rivals={suggestedRivals}
              onCompare={handleRivalsCompare}
            />

            <AgentProfilePremiumBanner hasAccess={hasIntelligenceAccess(user)} />

            <ProfileIntelligenceRow profile={enriched} />

            <CompareAgentModal
              open={compareOpen}
              onClose={() => setCompareOpen(false)}
              currentName={enriched.name}
              currentSlug={slug}
              suggestedRivals={suggestedRivals}
              allOptions={compareOptions}
              recentSlugs={recentCompareSlugs}
              onSelect={navigateCompare}
            />

          </section>



          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px] lg:gap-4 xl:gap-5 lg:items-start pb-2">

            <main className="min-w-0">
              <ProfileTabs active={activeTab} onChange={setActiveTab} counts={tabCounts} />



              {activeTab === "overview" && (
                <ProfileOverviewTab profile={enriched} isOwner={isOwner} />
              )}

              {activeTab === "reads" && (
                <ProfilePublicReadsSection
                  authorIdOrHandle={slug}
                  authorName={enriched.name}
                />
              )}

              {activeTab === "receipts" && <VerifiedCallsSection profile={enriched} />}

              {activeTab === "reputation" && (
                <ProfileDashboard
                  profile={enriched}
                  onFeaturedMarksUpdated={(keys, marks) => {
                    setProfile((p) => {
                      if (!p?.reputation) return p;
                      return {
                        ...p,
                        reputation: {
                          ...p.reputation,
                          featured_milestone_keys: keys,
                          featured_reputation_marks: marks,
                        },
                      };
                    });
                  }}
                />
              )}

            </main>

            <div className="space-y-3">
              <AgentProfileSidebar profile={enriched} />
              <RelatedIntelligence entityType="agent" entityId={slug} />
            </div>

          </div>

        </>

      )}

    </FeedShell>

  );

}

