"use client";

import Link from "next/link";
import type { EnrichedAgent, RivalryHeatEntry } from "@/components/agents/types";
import { PanelShell, LiveDot } from "@/components/feed/shared";
import { RivalriesHeating } from "@/components/agents/RivalriesHeating";
import { buildRivalryHeatList } from "@/components/agents/agentEnrichment";
import { ConsensusShiftModule } from "./ConsensusShiftModule";
import { NetworkPulse } from "./NetworkPulse";
import type { FollowingFeed, NetworkProfileTag } from "./types";

function IntelRow({
  label,
  agent,
  metric,
}: {
  label: string;
  agent: EnrichedAgent | undefined;
  metric: string;
}) {
  if (!agent) return null;
  return (
    <Link
      href={`/agents/${agent.slug}`}
      className="block p-1.5 -mx-0.5 rounded-lg hover:bg-zinc-900/70 feed-hover-lift cursor-pointer"
    >
      <p className="text-[9px] text-zinc-600 uppercase tracking-wider">{label}</p>
      <p className="text-[11px] font-medium text-zinc-200 truncate">{agent.name}</p>
      <p className="text-[10px] text-violet-400/80">{metric}</p>
    </Link>
  );
}

const TAG_DOT: Record<NetworkProfileTag["tone"], string> = {
  violet: "bg-violet-400",
  rose: "bg-rose-400",
  emerald: "bg-emerald-400",
  sky: "bg-sky-400",
  amber: "bg-amber-400",
  zinc: "bg-zinc-500",
};

export function FollowingSidebar({
  agents,
  feed,
  profileTags = [],
}: {
  agents: EnrichedAgent[];
  feed: FollowingFeed;
  profileTags?: NetworkProfileTag[];
}) {
  const aligned = [...agents].sort((a, b) => b.agreement_pct - a.agreement_pct)[0];
  const opposite = [...agents].sort((a, b) => a.agreement_pct - b.agreement_pct)[0];
  const mover = [...agents].sort((a, b) => b.rank_delta - a.rank_delta)[0];
  const early = [...agents].sort((a, b) => b.early_on_pct - a.early_on_pct)[0];
  const consensus =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.agreement_pct, 0) / agents.length)
      : 50;
  const topReceipt = [...agents].sort((a, b) => b.receipts_count - a.receipts_count)[0];
  const timingLeader = [...agents].sort((a, b) => b.early_on_pct - a.early_on_pct)[0];
  const cooling = agents.filter((a) => a.trend === "down").length;
  const rising = agents.filter((a) => a.trend === "up").length;

  const yesTakes = feed.new_takes.filter((t) => t.side === "YES").length;
  const direction: "up" | "down" | "flat" =
    yesTakes > feed.new_takes.length / 2
      ? "up"
      : yesTakes < feed.new_takes.length / 2 && feed.new_takes.length > 0
        ? "down"
        : "flat";

  const rivalryHeat: RivalryHeatEntry[] = buildRivalryHeatList(agents).filter(
    (r) => agents.some((a) => a.slug === r.rival_slug),
  );

  const pulseItems = [
    {
      label: "Faction shifts",
      value: rising > cooling ? `${rising} rising` : `${cooling} cooling`,
      tone: rising > cooling ? ("emerald" as const) : ("rose" as const),
    },
    {
      label: "Followed rivalries",
      value: String(rivalryHeat.length || feed.feed_events.filter((e) => e.type === "rivalry").length),
      tone: "rose" as const,
    },
    {
      label: "Verification pressure",
      value: String(feed.feed_events.filter((e) => e.type === "receipt").length),
      tone: "violet" as const,
    },
    {
      label: "Network mood",
      value:
        feed.new_takes.length >= 3 ? "Elevated" : feed.feed_events.length > 2 ? "Active" : "Calm",
      tone: "violet" as const,
    },
    {
      label: "Timing leaders",
      value: timingLeader?.name ?? "—",
      tone: "emerald" as const,
    },
    {
      label: "Emerging fractures",
      value: String(feed.feed_events.filter((e) => e.type === "consensus_shift").length),
      tone: "amber" as const,
    },
    {
      label: "Rep migration",
      value: mover ? `+${mover.rank_delta} ${mover.name.split(" ")[0]}` : "—",
      tone: "emerald" as const,
    },
  ];

  return (
    <aside className="space-y-3 feed-intel-rail hidden lg:block">
      <PanelShell title="Live network pulse" subtitle="Compact · your graph" badge={<LiveDot color="violet" />}>
        <NetworkPulse items={pulseItems} />
      </PanelShell>

      {profileTags.length > 0 && (
        <PanelShell title="Network identity" subtitle="Your conviction fingerprint">
          <ul className="px-2.5 py-2 space-y-1.5">
            {profileTags.slice(0, 5).map((tag) => (
              <li key={tag.label} className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${TAG_DOT[tag.tone]}`} />
                <span className="text-[10px] text-zinc-300">{tag.label}</span>
              </li>
            ))}
          </ul>
        </PanelShell>
      )}

      <RivalriesHeating rivalries={rivalryHeat} />

      <PanelShell title="Network intelligence" subtitle="Alignment & divergence">
        <div className="px-2 py-1 divide-y divide-zinc-800/60">
          <IntelRow
            label="Highest alignment"
            agent={aligned}
            metric={`${aligned?.agreement_pct ?? 0}% worldview overlap`}
          />
          <IntelRow
            label="Greatest divergence"
            agent={opposite}
            metric={`${opposite?.disagreement_pct ?? 0}% off your thesis`}
          />
          <IntelRow
            label="Reputation mover"
            agent={mover}
            metric={mover ? `+${mover.rank_delta} this week` : "—"}
          />
          <IntelRow
            label="Timing edge"
            agent={early}
            metric={early ? `${early.early_on_pct}% early rate` : "—"}
          />
        </div>
      </PanelShell>

      <PanelShell title="Network conviction" subtitle="Aggregate YES lean">
        <div className="p-2.5">
          <ConsensusShiftModule
            label="Your network lean"
            value={consensus}
            direction={direction}
            agents={agents.slice(0, 4).map((a) => a.name)}
          />
        </div>
      </PanelShell>

      <PanelShell title="Signal traction" subtitle="Receipts compounding">
        <div className="px-2 py-1">
          <IntelRow
            label="Receipts leader"
            agent={topReceipt}
            metric={topReceipt ? `${topReceipt.receipts_count} verified` : "—"}
          />
        </div>
      </PanelShell>
    </aside>
  );
}
