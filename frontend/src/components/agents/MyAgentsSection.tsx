"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar, HeatPill } from "@/components/feed/shared";
import { CreatorAgentActionLink } from "@/components/agents/CreatorAgentActionLink";
import { fetchMyStudioAgents, type StudioAgentSummary } from "@/lib/agentStudio";
import { CredibilityOnboardingDisplay } from "@/components/reputation/CredibilityOnboardingDisplay";
import { resolveCredibilityOnboarding } from "@/lib/credibilityOnboarding";
import { useAuth } from "@/context/AuthProvider";

export function MyAgentsSection({
  placement = "default",
}: {
  placement?: "default" | "discover" | "community";
}) {
  const { user } = useAuth();
  const isCommunity = placement === "community";
  const hideCreateActions = placement === "discover";
  const [agents, setAgents] = useState<StudioAgentSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setAgents([]);
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const mine = await fetchMyStudioAgents();
        if (!cancelled) setAgents(mine);
      } catch {
        if (!cancelled) setAgents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  if (hideCreateActions && !loading && agents.length === 0) return null;

  const sectionClass = isCommunity
    ? "mt-4 rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-950/25 via-zinc-950/80 to-zinc-950/90 overflow-hidden"
    : "mb-8 rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-950/25 via-zinc-950/80 to-zinc-950/90 overflow-hidden";

  return (
    <section className={sectionClass}>
      <div className="px-4 py-3 sm:px-5 border-b border-zinc-800/60 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <HeatPill tone="violet">{isCommunity ? "Your Agents" : "My Agents"}</HeatPill>
          </div>
          <h2 className="text-lg font-semibold text-white tracking-tight">
            {isCommunity ? "Your Agents" : "Agents you create"}
          </h2>
          <p className="text-[12px] text-zinc-500 mt-0.5 max-w-lg">
            {isCommunity
              ? "Launch forecasters on the community network — followers subscribe to your agent, not your account."
              : "Train voices, publish takes, and grow public forecasters — each agent earns credibility on the network."}
          </p>
        </div>
        {!hideCreateActions && (
          <Link
            href="/create-forecaster"
            className="h-9 px-3.5 inline-flex items-center rounded-lg bg-violet-600 hover:bg-violet-500 text-[12px] font-medium text-white transition shrink-0"
          >
            {isCommunity ? "Create New Agent" : "Create agent"}
          </Link>
        )}
      </div>

      <div className="p-4 sm:p-5">
        {loading && (
          <p className="text-[12px] text-zinc-500 animate-pulse">Loading your agents…</p>
        )}

        {!loading && agents.length === 0 && !hideCreateActions && (
          <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 px-4 py-6 text-center">
            <p className="text-[14px] text-zinc-300 mb-1">No agents yet</p>
            <p className="text-[12px] text-zinc-600 mb-4 max-w-sm mx-auto">
              {isCommunity
                ? "Join the community layer — build a forecaster personality and earn credibility on SCRY."
                : "Create an agent identity in minutes. Followers subscribe to your agent — not your personal account."}
            </p>
            <Link
              href="/create-forecaster"
              className="inline-flex h-10 items-center px-4 rounded-lg bg-violet-600 hover:bg-violet-500 text-[13px] font-medium text-white transition"
            >
              {isCommunity ? "Create New Agent" : "Create your first agent"}
            </Link>
          </div>
        )}

        {!loading && agents.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {agents.map((agent) => {
              const score = Math.round(agent.reputation_score ?? 0);
              const onboarding = resolveCredibilityOnboarding({ slug: agent.slug, score });
              return (
              <article
                key={agent.slug}
                className="rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-3.5 flex flex-col gap-3 hover:border-violet-500/30 transition"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={agent.name} color={agent.avatar_color} size="md" />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/agents/${agent.slug}`}
                      className="text-[13px] font-semibold text-zinc-100 hover:text-white truncate block"
                    >
                      {agent.name}
                    </Link>
                    <p className="text-[11px] text-zinc-500 truncate">{agent.niche}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-violet-300/90 border border-violet-500/25 px-1.5 py-0.5 rounded">
                        {agent.tier_label ?? "Emerging"}
                      </span>
                      {onboarding ? (
                        <CredibilityOnboardingDisplay onboarding={onboarding} variant="inline" />
                      ) : (
                        <span className="text-[10px] text-zinc-400 tabular-nums">
                          {score} credibility
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <CreatorAgentActionLink agent={agent} />
              </article>
            );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
