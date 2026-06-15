"use client";



import Link from "next/link";

import { useParams, useRouter, useSearchParams } from "next/navigation";

import { Suspense, useEffect, useMemo, useState } from "react";

import { FeedShell } from "@/components/feed/FeedShell";

import { HeatPill, LiveDot } from "@/components/feed/shared";

import {

  AgentStudioAudienceTab,

  AgentStudioDashboardTab,

  AgentStudioRevenueTab,

} from "@/components/agent-studio/AgentStudioAnalytics";

import { AgentStudioHeaderActions } from "@/components/agent-studio/AgentStudioHeaderActions";
import { AgentStudioReadsSection } from "@/components/agent-studio/AgentStudioReadsSection";

import { AgentStudioKnowledgeTab } from "@/components/agent-studio/AgentStudioKnowledgeTab";
import { AgentStudioSettingsTab } from "@/components/agent-studio/AgentStudioSettingsTab";

import { AgentStudioTabs, type AgentStudioTabKey } from "@/components/agent-studio/AgentStudioTabs";

import { buildFallbackProfile } from "@/components/agents/profile/fallbackData";

import { enrichAgentProfile } from "@/components/agents/profile/profileEnrichment";

import { mergeAgentProfileWithReputation } from "@/components/agents/profile/mergeReputation";

import type { AgentProfile } from "@/components/agents/profile/types";


import { apiFetch } from "@/lib/api";

import {

  fetchStudioAgent,

  StudioAccessError,

  studioAgentPath,

} from "@/lib/agentStudio";

import { fetchAgentReputation } from "@/lib/reputation";

import { useAuth } from "@/context/AuthProvider";

import { redirectToLogin } from "@/lib/authRedirect";



export default function StudioAgentPage() {
  return (
    <Suspense
      fallback={
        <FeedShell activeNav="Agents" hideCategoryNav>
          <div className="py-16 flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-violet-500/30 border-t-violet-400 animate-spin" />
            <p className="text-zinc-500 text-sm">Loading Agent Studio…</p>
          </div>
        </FeedShell>
      }
    >
      <StudioAgentPageContent />
    </Suspense>
  );
}

function StudioAgentPageContent() {
  const router = useRouter();

  const { user, loading: authLoading } = useAuth();

  const params = useParams();
  const searchParams = useSearchParams();

  const slug = typeof params.slug === "string" ? params.slug : "";



  const [profile, setProfile] = useState<AgentProfile | null>(null);

  const [loading, setLoading] = useState(true);

  const [accessDenied, setAccessDenied] = useState(false);

  const [draftId, setDraftId] = useState<number | null>(null);

  const tabParam = searchParams.get("tab");
  const initialTab: AgentStudioTabKey =
    tabParam === "reads" ||
    tabParam === "audience" ||
    tabParam === "revenue" ||
    tabParam === "knowledge" ||
    tabParam === "settings"
      ? tabParam
      : "dashboard";
  const [activeTab, setActiveTab] = useState<AgentStudioTabKey>(initialTab);

  useEffect(() => {
    if (
      tabParam === "reads" ||
      tabParam === "audience" ||
      tabParam === "revenue" ||
      tabParam === "knowledge" ||
      tabParam === "settings" ||
      tabParam === "dashboard"
    ) {
      setActiveTab(tabParam === "dashboard" ? "dashboard" : tabParam);
    }
  }, [tabParam]);



  const enriched = useMemo(

    () => (profile ? enrichAgentProfile(profile) : null),

    [profile],

  );



  useEffect(() => {

    if (!slug || authLoading) return;

    if (!user) {

      redirectToLogin(router, studioAgentPath(slug));

      return;

    }



    let cancelled = false;



    async function load() {

      setLoading(true);

      setAccessDenied(false);

      try {

        const studio = await fetchStudioAgent(slug);

        if (studio.owner_user_id !== user!.id) {

          if (!cancelled) {

            setAccessDenied(true);

            setLoading(false);

          }

          return;

        }



        if (!cancelled) {

          setDraftId(studio.creator_forecaster_id);

        }



        const [agentRes, reputation] = await Promise.all([

          apiFetch(`/agents/${encodeURIComponent(slug)}`, {}, false),

          fetchAgentReputation(slug),

        ]);



        let base: AgentProfile;

        if (agentRes.ok) {

          base = (await agentRes.json()) as AgentProfile;

        } else {

          base = { ...buildFallbackProfile(slug), ...studio };

        }



        if (!cancelled) {

          setProfile(mergeAgentProfileWithReputation(base, reputation));

        }

      } catch (err) {

        if (!cancelled) {

          if (err instanceof StudioAccessError) {

            setAccessDenied(true);

          } else {

            setProfile(buildFallbackProfile(slug));

          }

        }

      } finally {

        if (!cancelled) setLoading(false);

      }

    }



    load();

    return () => {

      cancelled = true;

    };

  }, [slug, user, authLoading, router]);



  if (!slug) {

    return (

      <FeedShell activeNav="Agents" hideCategoryNav>

        <p className="text-zinc-500 text-sm py-16 text-center">Invalid agent.</p>

      </FeedShell>

    );

  }



  if (authLoading || loading) {

    return (

      <FeedShell activeNav="Agents" hideCategoryNav>

        <div className="py-16 flex flex-col items-center gap-3">

          <div className="h-8 w-8 rounded-full border-2 border-violet-500/30 border-t-violet-400 animate-spin" />

          <p className="text-zinc-500 text-sm">Loading Agent Studio…</p>

        </div>

      </FeedShell>

    );

  }



  if (!user) return null;



  if (accessDenied) {

    return (

      <FeedShell activeNav="Agents" hideCategoryNav>

        <div className="max-w-lg mx-auto py-16 text-center space-y-4">

          <p className="text-zinc-300 text-sm">You do not manage this agent.</p>

          <Link

            href={`/agents/${slug}`}

            className="inline-block text-sm text-violet-400 hover:text-violet-300"

          >

            View public profile →

          </Link>

        </div>

      </FeedShell>

    );

  }



  if (!enriched) return null;



  return (

    <FeedShell

      activeNav="Agents"

      hideCategoryNav

      headerExtra={

        <div className="pb-2 border-b border-zinc-800/50 -mb-px">

          <Link

            href={`/agents/${slug}`}

            className="text-[11px] text-zinc-500 hover:text-zinc-300 transition inline-flex items-center gap-1"

          >

            ← Public profile

          </Link>

        </div>

      }

    >

      <div className="flex flex-wrap items-center gap-2 mb-3 px-0.5 min-w-0">

        <LiveDot color="violet" />

        <p className="text-[11px] text-zinc-500 truncate">Agent Studio · {enriched.name}</p>

        <HeatPill tone="violet">Creator</HeatPill>

      </div>



      <header className="mb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">

        <div className="min-w-0">

          <h1 className="text-xl font-semibold text-white tracking-tight">{enriched.name}</h1>

          <p className="text-[12px] text-zinc-500 mt-1">

            Run your forecasting desk - conviction, positions, reads, receipts, and reputation.

          </p>

        </div>

        <AgentStudioHeaderActions profile={enriched} />

      </header>



      <AgentStudioTabs active={activeTab} onChange={setActiveTab} />



      {activeTab === "dashboard" && (

        <AgentStudioDashboardTab

          profile={enriched}

          onViewAudience={() => setActiveTab("audience")}

        />

      )}

      {activeTab === "reads" && <AgentStudioReadsSection profile={enriched} />}

      {activeTab === "audience" && <AgentStudioAudienceTab profile={enriched} />}

      {activeTab === "revenue" && <AgentStudioRevenueTab profile={enriched} />}

      {activeTab === "knowledge" && (
        <AgentStudioKnowledgeTab profile={enriched} forecasterId={draftId} />
      )}

      {activeTab === "settings" && (

        <AgentStudioSettingsTab profile={enriched} draftId={draftId} />

      )}

    </FeedShell>

  );

}

