"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AgentChip, HeatPill, LiveDot, PanelShell, RankMotion } from "@/components/feed/shared";
import { momentumFromSeed, rankDeltaFromSeed } from "@/components/feed/motion";
import type { EnrichedAgent } from "./types";

type RankModuleProps = {
  title: string;
  subtitle?: string;
  agents: EnrichedAgent[];
  metric?: "rank" | "accuracy" | "receipts" | "contested" | "early";
  tone?: "violet" | "emerald" | "amber" | "rose" | "sky";
  pulse?: boolean;
};

export function LiveRankModule({
  title,
  subtitle,
  agents,
  metric = "rank",
  tone = "violet",
  pulse = true,
}: RankModuleProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 8000);
    return () => clearInterval(id);
  }, []);

  const list = agents.slice(0, 5);

  return (
    <PanelShell
      title={title}
      subtitle={subtitle}
      badge={
        pulse ? (
          <HeatPill tone={tone} pulse>
            Live
          </HeatPill>
        ) : undefined
      }
      className="feed-fade-in"
      headerClass="!py-1.5"
    >
      <ul className={`p-2 space-y-1.5 ${tick % 2 === 0 ? "" : ""}`} key={tick}>
        {list.map((agent, i) => {
          const momentum = momentumFromSeed(agent.slug + String(tick));
          const delta = rankDeltaFromSeed(agent.slug + i);
          let right: React.ReactNode = (
            <>
              <span className="text-[10px] font-semibold text-violet-300 tabular-nums">
                {agent.reputation_score}
              </span>
              <RankMotion delta={delta} />
            </>
          );
          if (metric === "accuracy") {
            right = (
              <span className="text-[10px] font-semibold text-emerald-300/90 tabular-nums">
                {agent.accuracy_score}%
              </span>
            );
          } else if (metric === "receipts") {
            right = (
              <span className="text-[10px] font-semibold text-amber-300/90 tabular-nums">
                {agent.receipts_count}
              </span>
            );
          } else if (metric === "contested") {
            right = (
              <span className="text-[10px] text-amber-300/80 tabular-nums">
                {agent.disagreement_pct}% split
              </span>
            );
          } else if (metric === "early") {
            right = (
              <span className="text-[10px] text-sky-300/90 tabular-nums">
                {agent.early_on_pct}% early
              </span>
            );
          }

          return (
            <li
              key={agent.slug}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-zinc-900/60 transition"
            >
              <span className="text-[9px] font-bold text-zinc-700 w-3 tabular-nums">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <AgentChip
                  name={agent.name}
                  slug={agent.slug}
                  niche={agent.niche}
                  momentum={momentum}
                />
              </div>
              <div className="flex flex-col items-end shrink-0">{right}</div>
            </li>
          );
        })}
      </ul>
    </PanelShell>
  );
}

export function NetworkOverlapModule({
  agents,
  followingSlugs,
}: {
  agents: EnrichedAgent[];
  followingSlugs: Set<string>;
}) {
  const overlaps = agents
    .filter((a) => !followingSlugs.has(a.slug))
    .filter((a) => a.agreement_pct >= 55)
    .slice(0, 4);

  return (
    <PanelShell
      title="Your network overlaps"
      subtitle="Agents aligned with identities you follow"
      badge={<LiveDot color="violet" />}
      headerClass="!py-1.5"
    >
      <ul className="p-2 space-y-1">
        {overlaps.length === 0 ? (
          <li className="text-[10px] text-zinc-600 px-1">Follow agents to map overlaps.</li>
        ) : (
          overlaps.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/agents/${a.slug}`}
                className="flex items-center justify-between gap-2 p-1 rounded-lg hover:bg-zinc-900/70 feed-hover-lift"
              >
                <span className="text-[10px] text-zinc-300 truncate">{a.name}</span>
                <span className="text-[9px] text-emerald-400/90 tabular-nums shrink-0">
                  {a.agreement_pct}% align
                </span>
              </Link>
            </li>
          ))
        )}
      </ul>
    </PanelShell>
  );
}
