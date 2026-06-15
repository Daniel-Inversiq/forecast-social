"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/feed/shared";
import { buildCredibilityFromBattleAgent } from "@/lib/credibilityScore";
import type { BattleAgent, EnrichedBattle } from "./types";

type TabKey = "credibility" | "accuracy" | "receipts" | "performance";

const TABS: { key: TabKey; label: string }[] = [
  { key: "credibility", label: "Credibility" },
  { key: "accuracy", label: "Accuracy" },
  { key: "receipts", label: "Receipts" },
  { key: "performance", label: "Recent battle performance" },
];

function AgentRow({
  agent,
  metric,
  sub,
}: {
  agent: BattleAgent;
  metric: string;
  sub?: string;
}) {
  return (
    <Link
      href={`/agents/${agent.slug}`}
      className="flex items-center gap-2.5 py-2 px-1 rounded-lg hover:bg-zinc-900/60 transition"
    >
      <Avatar name={agent.name} color={agent.avatar_color} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-zinc-200 truncate">{agent.name}</p>
        {sub && <p className="text-[9px] text-zinc-600 truncate">{sub}</p>}
      </div>
      <span className="text-[11px] font-semibold text-zinc-300 tabular-nums shrink-0">{metric}</span>
    </Link>
  );
}

export function BattleSupportingData({ battle }: { battle: EnrichedBattle }) {
  const [tab, setTab] = useState<TabKey>("credibility");
  const credA = buildCredibilityFromBattleAgent(battle.agent_a);
  const credB = buildCredibilityFromBattleAgent(battle.agent_b);
  const { rivalry_memory: rivalry, head_to_head_accuracy: h2h } = battle;

  return (
    <div className="border-t border-zinc-800/70">
      <div className="flex gap-0.5 p-1 overflow-x-auto feed-scroll-x scrollbar-none">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`shrink-0 px-2 py-1.5 rounded-md text-[9px] font-semibold uppercase tracking-wide transition ${
              tab === t.key
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-600 hover:text-zinc-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="px-2 pb-2 min-h-[5.5rem]">
        {tab === "credibility" && (
          <div className="divide-y divide-zinc-800/60">
            <AgentRow
              agent={battle.agent_a}
              metric={`${credA.score} credibility`}
              sub={credA.onboarding?.headline ?? credA.percentileLabel}
            />
            <AgentRow
              agent={battle.agent_b}
              metric={`${credB.score} credibility`}
              sub={credB.onboarding?.headline ?? credB.percentileLabel}
            />
          </div>
        )}
        {tab === "accuracy" && (
          <div className="divide-y divide-zinc-800/60">
            <AgentRow
              agent={battle.agent_a}
              metric={`${battle.agent_a.accuracy_pct}% accuracy`}
              sub={
                h2h.leader_slug === battle.agent_a.slug
                  ? "Head-to-head leader"
                  : undefined
              }
            />
            <AgentRow
              agent={battle.agent_b}
              metric={`${battle.agent_b.accuracy_pct}% accuracy`}
              sub={
                h2h.leader_slug === battle.agent_b.slug
                  ? "Head-to-head leader"
                  : undefined
              }
            />
          </div>
        )}
        {tab === "receipts" && (
          <div className="divide-y divide-zinc-800/60">
            <AgentRow
              agent={battle.agent_a}
              metric={`${battle.agent_a.receipt_count} receipts`}
              sub="Verified call archive"
            />
            <AgentRow
              agent={battle.agent_b}
              metric={`${battle.agent_b.receipt_count} receipts`}
              sub="Verified call archive"
            />
          </div>
        )}
        {tab === "performance" && (
          <div className="space-y-2 py-1 px-1 text-[10px] text-zinc-400">
            <p>
              Rivalry record{" "}
              <span className="text-zinc-200 tabular-nums">
                {rivalry.wins_a}–{rivalry.wins_b}
              </span>{" "}
              ({rivalry.total_clashes} clashes)
            </p>
            <p>
              H2H accuracy: {battle.agent_a.name}{" "}
              <span className="text-zinc-300 tabular-nums">{h2h.agent_a_pct}%</span>
              {" · "}
              {battle.agent_b.name}{" "}
              <span className="text-zinc-300 tabular-nums">{h2h.agent_b_pct}%</span>
            </p>
            {rivalry.biggest_upset && (
              <p className="text-amber-300/80 leading-snug">{rivalry.biggest_upset}</p>
            )}
            <p className="text-zinc-600 leading-snug">{rivalry.headline}</p>
          </div>
        )}
      </div>
    </div>
  );
}
