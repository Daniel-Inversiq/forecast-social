"use client";

import Link from "next/link";
import { PanelShell, LiveDot } from "@/components/feed/shared";
import type { EnrichedAgent } from "./types";
import {
  agentsToFollowNow,
  bestTimingEdge,
  cultFormingAgents,
  fastestRising,
  mostControversial,
  mostUsefulForFeed,
} from "./agentDiscovery";

function DiscoveryPanel({
  title,
  subtitle,
  agents,
  tone = "violet",
}: {
  title: string;
  subtitle?: string;
  agents: EnrichedAgent[];
  tone?: "violet" | "emerald" | "rose" | "amber" | "sky";
}) {
  if (agents.length === 0) return null;

  const toneText =
    tone === "emerald"
      ? "text-emerald-400"
      : tone === "rose"
        ? "text-rose-400"
        : tone === "amber"
          ? "text-amber-400"
          : tone === "sky"
            ? "text-sky-400"
            : "text-violet-400";

  return (
    <PanelShell
      title={title}
      subtitle={subtitle}
      headerClass="!py-2"
      className="min-w-0 h-full flex flex-col"
    >
      <ul className="p-3 space-y-1.5 flex-1">
        {agents.map((a, i) => (
          <li key={a.slug}>
            <Link
              href={`/agents/${a.slug}`}
              className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-zinc-900/70 feed-hover-lift group"
            >
              <span className={`text-[10px] font-bold tabular-nums mt-0.5 shrink-0 ${toneText}`}>
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-zinc-100 truncate group-hover:text-white">
                  {a.name}
                </p>
                <p className="text-[12px] text-zinc-200 font-medium line-clamp-2 leading-snug mt-0.5">
                  {a.personality_quote}
                </p>
                <p className="text-[9px] text-zinc-600 line-clamp-2 leading-snug mt-1.5">
                  {a.recent_take}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </PanelShell>
  );
}

export function AgentsDiscoveryRail({
  agents,
  followingSlugs,
  compactTop = false,
}: {
  agents: EnrichedAgent[];
  followingSlugs: Set<string>;
  /** Tighter spacing when stacked below primary agent sections (e.g. Community tab). */
  compactTop?: boolean;
}) {
  const row1 = [
    {
      title: "Follow now",
      subtitle: "Worth adding to your feed",
      list: agentsToFollowNow(agents, followingSlugs),
      tone: "emerald" as const,
    },
    {
      title: "Most controversial",
      subtitle: "Highest disagreement",
      list: mostControversial(agents),
      tone: "rose" as const,
    },
    {
      title: "Fastest rising",
      subtitle: "Reputation velocity",
      list: fastestRising(agents),
      tone: "emerald" as const,
    },
  ];

  const row2 = [
    {
      title: "Best timing edge",
      subtitle: "Early-on rate",
      list: bestTimingEdge(agents),
      tone: "sky" as const,
    },
    {
      title: "Cult forming",
      subtitle: "Follower momentum",
      list: cultFormingAgents(agents),
      tone: "violet" as const,
    },
    {
      title: "For your feed",
      subtitle: "Fills coverage gaps",
      list: mostUsefulForFeed(agents, followingSlugs),
      tone: "amber" as const,
    },
  ];

  const hasAny = [...row1, ...row2].some((m) => m.list.length > 0);
  if (!hasAny) return null;

  return (
    <section
      className={
        compactTop
          ? "mt-5 pt-4 border-t border-zinc-800/60"
          : "mt-8 pt-6 border-t border-zinc-800/60"
      }
    >
      <div className="flex items-center gap-2 mb-4 px-0.5">
        <LiveDot color="violet" />
        <h2 className="text-sm font-semibold text-zinc-400">Quick picks</h2>
        <span className="text-[10px] text-zinc-600">Curated lists — browse personalities above first</span>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {row1.map((m) => (
            <DiscoveryPanel
              key={m.title}
              title={m.title}
              subtitle={m.subtitle}
              agents={m.list}
              tone={m.tone}
            />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {row2.map((m) => (
            <DiscoveryPanel
              key={m.title}
              title={m.title}
              subtitle={m.subtitle}
              agents={m.list}
              tone={m.tone}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
