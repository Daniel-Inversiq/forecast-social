"use client";

import Link from "next/link";
import { PanelShell } from "@/components/feed/shared";
import { NetworkPulse } from "@/components/following/NetworkPulse";
import { ConvictionNetworkLayer } from "./ConvictionNetworkLayer";
import { PositionPressureFeed } from "./PositionPressureFeed";
import type {
  EnrichedActivePosition,
  EnrichedResolvedPosition,
  NetworkAgent,
  PressureFeedItem,
  Stats,
} from "./types";

export function PositionsSidebar({
  stats,
  active,
  resolved,
  pressureFeed,
  networkAgents,
}: {
  stats: Stats;
  active: EnrichedActivePosition[];
  resolved: EnrichedResolvedPosition[];
  pressureFeed: PressureFeedItem[];
  networkAgents: NetworkAgent[];
}) {
  const repImpact = resolved.reduce((s, p) => s + p.reputation_delta, 0);
  const repAtRisk = active.reduce((s, p) => s + p.rep_exposure, 0);
  const isolated = active.filter((p) => p.network_agreement < 40).length;
  const nearVerify = active.filter((p) => p.verification_odds >= 65).length;

  const pulseItems = [
    { label: "Rep at risk", value: String(repAtRisk), tone: "violet" as const },
    { label: "Isolated theses", value: String(isolated), tone: "violet" as const },
    { label: "Near verification", value: String(nearVerify), tone: "emerald" as const },
  ];

  return (
    <aside className="space-y-3 feed-intel-rail">
      <PanelShell title="Reputation exposure" subtitle="Standing on the line">
        <div className="px-2.5 py-2">
          <p
            className={`text-xl font-semibold tabular-nums ${
              repImpact >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {repImpact >= 0 ? "+" : ""}
            {repImpact}
          </p>
          <p className="text-[10px] text-zinc-600">Net from archived receipts</p>
          <p className="text-[10px] text-rose-400/80 mt-1 tabular-nums">{repAtRisk} at risk on open calls</p>
        </div>
      </PanelShell>

      <PositionPressureFeed items={pressureFeed} />

      <PanelShell title="Consensus posture" subtitle="Open conviction alignment">
        <div className="px-2.5 py-2 space-y-1.5">
          {active.length === 0 ? (
            <p className="text-[10px] text-zinc-600">No open convictions.</p>
          ) : (
            active.slice(0, 4).map((p) => (
              <Link
                key={p.id}
                href={`/markets/${p.slug}`}
                className="flex justify-between gap-2 text-[10px] hover:text-violet-300 transition"
              >
                <span className="text-zinc-400 truncate">{p.market_title}</span>
                <span
                  className={`tabular-nums shrink-0 ${
                    p.network_agreement < 40 ? "text-amber-400" : "text-emerald-400/90"
                  }`}
                >
                  {p.network_agreement}%
                </span>
              </Link>
            ))
          )}
        </div>
      </PanelShell>

      <ConvictionNetworkLayer agents={networkAgents} />

      <PanelShell title="Ledger pulse">
        <NetworkPulse items={pulseItems} />
        <p className="px-2.5 pb-2 text-[9px] text-zinc-700">
          {stats.active_count} active · {stats.resolved_count} archived
        </p>
      </PanelShell>
    </aside>
  );
}
