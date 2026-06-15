"use client";

import Link from "next/link";
import { HeatPill, PanelShell } from "@/components/feed/shared";
import { LivePulsePanel } from "@/components/LivePulsePanel";
import { BiggestReputationGains } from "./BiggestReputationGains";
import { buildAgentRanks, buildVerificationStreaks } from "./verifiedCallEnrichment";
import type { EnrichedVerifiedCall } from "./types";
import type { BiggestReputationGain } from "@/lib/receipts";

function AgentRow({
  slug,
  name,
  avatar_color,
  metric,
  sub,
}: {
  slug: string;
  name: string;
  avatar_color: string;
  metric: string;
  sub?: string;
}) {
  return (
    <li>
      <Link
        href={`/agents/${slug}`}
        className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-900/60 transition rounded-lg mx-1"
      >
        <div
          className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-semibold text-white shrink-0"
          style={{ backgroundColor: avatar_color }}
        >
          {name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium text-zinc-200 truncate">{name}</p>
          {sub && <p className="text-[9px] text-zinc-600 truncate">{sub}</p>}
        </div>
        <span className="text-[10px] font-semibold text-amber-300/90 tabular-nums shrink-0">
          {metric}
        </span>
      </Link>
    </li>
  );
}

export function VerifiedCallsSidebar({
  calls,
  biggestGains = [],
}: {
  calls: EnrichedVerifiedCall[];
  biggestGains?: BiggestReputationGain[];
}) {
  const ranks = buildAgentRanks(calls);
  const streaks = buildVerificationStreaks(calls).slice(0, 4);
  const recent = [...calls]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 4);
  const timingLeaders = [...calls]
    .sort((a, b) => b.days_early - a.days_early)
    .slice(0, 4);
  const resurfaced = calls
    .filter((c) => c.receipt_strength === "legendary")
    .slice(0, 3);
  const pulseCount = calls.filter((c) => {
    const d = new Date(c.created_at);
    const days = (Date.now() - d.getTime()) / 86400000;
    return days < 2;
  }).length;

  return (
    <aside className="space-y-3 feed-intel-rail hidden lg:block sticky top-[52px] self-start max-h-[calc(100vh-4rem)] overflow-y-auto scrollbar-none min-w-0">
      <PanelShell
        title="Verification pulse"
        subtitle="Archive activity"
        badge={
          <HeatPill tone="amber" pulse>
            Live
          </HeatPill>
        }
      >
        <div className="px-2 py-2 space-y-1.5 text-[10px]">
          <p className="text-zinc-400">
            <span className="text-amber-200/90 font-semibold tabular-nums">{pulseCount}</span>{" "}
            receipts sealed in 48h
          </p>
          <p className="text-zinc-600">
            {calls.filter((c) => c.ignored_at_first).length} ignored-at-first now vindicated
          </p>
        </div>
      </PanelShell>

      {biggestGains.length > 0 && <BiggestReputationGains gains={biggestGains} />}

      <PanelShell title="Reputation migration" subtitle="Latest tier movement from proof">
        <ul className="divide-y divide-zinc-800/60">
          {biggestGains.length > 0
            ? biggestGains.slice(0, 4).map((g) => (
                <AgentRow
                  key={g.id}
                  slug={g.agent_slug}
                  name={g.agent_name}
                  avatar_color={g.avatar_color}
                  metric={`+${g.reputation_delta}`}
                  sub={g.market_title}
                />
              ))
            : ranks.slice(0, 4).map((a) => (
                <AgentRow
                  key={a.slug}
                  slug={a.slug}
                  name={a.name}
                  avatar_color={a.avatar_color}
                  metric={`+${a.reputation_total}`}
                  sub="cumulative from archive"
                />
              ))}
        </ul>
      </PanelShell>

      <PanelShell title="Recent receipts" subtitle="Latest permanent records">
        <ul className="divide-y divide-zinc-800/60">
          {recent.map((c) => (
            <li key={c.id}>
              <Link
                href={`/markets/${c.market_slug}`}
                className="block px-2 py-1.5 hover:bg-zinc-900/60"
              >
                <p className="text-[9px] font-mono text-amber-500/50">{c.receipt_id}</p>
                <p className="text-[10px] text-zinc-300 truncate">{c.market_title}</p>
                <p className="text-[9px] text-zinc-600">
                  {c.agent_name} · {c.days_early}d edge
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </PanelShell>

      <PanelShell title="Verification momentum" subtitle="Strongest timing leaders">
        <ul className="divide-y divide-zinc-800/60">
          {timingLeaders.map((c) => (
            <li key={`timing-${c.id}`}>
              <Link
                href={`/agents/${c.agent_slug}`}
                className="flex justify-between gap-2 px-2 py-1.5 hover:bg-zinc-900/60 text-[10px]"
              >
                <span className="text-zinc-300 truncate">{c.agent_name}</span>
                <span className="text-emerald-400/80 tabular-nums shrink-0">{c.days_early}d</span>
              </Link>
            </li>
          ))}
        </ul>
      </PanelShell>

      <PanelShell title="Legendary resurfacing" subtitle="Theses returning to dominance">
        <ul className="p-2 space-y-1.5">
          {resurfaced.map((c) => (
            <li key={c.id}>
              <Link
                href={`/markets/${c.market_slug}`}
                className="block rounded-lg border border-amber-500/15 bg-amber-950/15 px-2 py-1.5 hover:border-amber-500/30 transition"
              >
                <p className="text-[10px] font-medium text-amber-100/90 truncate">{c.market_title}</p>
                <p className="text-[9px] text-zinc-500">{c.season_title}</p>
              </Link>
            </li>
          ))}
        </ul>
      </PanelShell>

      <PanelShell title="Timing leaders" subtitle="Early signal dominance">
        <ul className="divide-y divide-zinc-800/60">
          {ranks.slice(0, 5).map((a) => (
            <AgentRow
              key={a.slug}
              slug={a.slug}
              name={a.name}
              avatar_color={a.avatar_color}
              metric={`${a.verified_count}`}
              sub="verified receipts"
            />
          ))}
        </ul>
      </PanelShell>

      <PanelShell title="Active streaks" subtitle="Prestigious proof runs">
        <ul className="divide-y divide-zinc-800/60">
          {streaks.map((s) => (
            <li key={s.id}>
              <Link
                href={`/agents/${s.agent_slug}`}
                className="block px-2 py-1.5 hover:bg-zinc-900/60 text-[10px]"
              >
                <span className="text-zinc-300">{s.agent_name}</span>
                <span className="text-zinc-600 block truncate">{s.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </PanelShell>

      <LivePulsePanel compact className="!rounded-xl" />
    </aside>
  );
}
