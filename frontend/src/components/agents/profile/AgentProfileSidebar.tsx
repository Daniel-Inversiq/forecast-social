"use client";

import Link from "next/link";
import {
  AgentChip,
  formatTimeAgo,
  HeatPill,
  LiveDot,
  MiniProbBar,
  MiniSparkline,
  PanelShell,
} from "@/components/feed/shared";
import { LabeledMetric } from "@/components/metrics/LabeledMetric";
import { ProfileFocusAreas } from "@/components/profile/ProfileFocusAreas";
import { LivePulsePanel } from "@/components/LivePulsePanel";
import { Sparkline } from "@/components/agents/Sparkline";
import type { EnrichedAgentProfile } from "./types";
import { RecentReceiptsSidebar } from "@/components/users/profile/reputation/RecentReceiptsSidebar";
import type { ScryReceipt } from "@/components/users/profile/reputation/types";
import type { PositionsPayload } from "@/components/positions/types";
import { YourRecentActivitySidebar } from "@/components/users/profile/YourRecentActivitySidebar";
import { isUserProfile } from "@/components/users/profile/userRecentActivity";
import type { EnrichedUserProfile } from "@/components/users/profile/types";
import {
  countResolvedReceipts,
  hasAlignedAgents,
  hasProfileSignals,
  hasSidebarPublicForecasts,
  sidebarPublicForecastRows,
} from "@/lib/profileSectionState";

export function AgentProfileSidebar({
  profile,
  scryReceipts,
  positions = null,
}: {
  profile: EnrichedAgentProfile;
  scryReceipts?: ScryReceipt[];
  positions?: PositionsPayload | null;
}) {
  const sparkTone =
    profile.trend === "up" ? "emerald" : profile.trend === "down" ? "amber" : "violet";
  const isUser = isUserProfile(profile);
  const userProfile = isUser ? (profile as EnrichedUserProfile) : null;
  const followingCount = isUser
    ? userProfile!.following_count
    : Math.max(12, Math.floor(profile.tracking_count / 40));
  const forecastRows = sidebarPublicForecastRows(profile, positions);
  const showPublicForecasts = hasSidebarPublicForecasts(profile, positions);
  const showReceipts = scryReceipts != null && countResolvedReceipts(scryReceipts) > 0;
  const showFocusAreas = profile.focus_areas.length > 0;
  const showAligned = hasAlignedAgents(profile);
  const showSignals = hasProfileSignals(profile);

  return (
    <aside className="space-y-3 feed-intel-rail hidden lg:block self-start min-w-0">
      {isUser && userProfile ? (
        <YourRecentActivitySidebar
          profile={userProfile}
          positions={positions}
          scryReceipts={scryReceipts}
        />
      ) : (
        profile.recent_events.length > 0 && (
          <PanelShell title="Live activity" subtitle="Conviction network pulse" headerClass="!py-1.5">
            <div className="p-2 flex items-center gap-2 border-b border-zinc-800/50">
              <LiveDot />
              <HeatPill tone="emerald" pulse>
                Live
              </HeatPill>
            </div>
            <div className="p-2">
              <LivePulsePanel compact />
            </div>
            <ul className="p-2 pt-0 space-y-2 max-h-[140px] overflow-y-auto scrollbar-none">
              {profile.recent_events.slice(0, 4).map((ev, i) => (
                <li
                  key={`${ev.title}-${i}`}
                  className="text-[10px] border-b border-zinc-800/40 last:border-0 pb-2"
                >
                  <p className="text-zinc-300 line-clamp-1 font-medium">{ev.title}</p>
                  <p className="text-[9px] text-zinc-600">{formatTimeAgo(ev.created_at)}</p>
                </li>
              ))}
            </ul>
          </PanelShell>
        )
      )}

      {showReceipts && scryReceipts && <RecentReceiptsSidebar receipts={scryReceipts} />}

      <PanelShell title="Network" subtitle="Following · followers" headerClass="!py-1.5">
        <div className="p-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2 py-2">
            <LabeledMetric
              value={String(followingCount)}
              label="Following"
              accent="text-zinc-200"
              size="sm"
            />
          </div>
          <div className="rounded-lg border border-violet-500/15 bg-violet-950/20 px-2 py-2">
            <LabeledMetric
              value={profile.follower_count.toLocaleString()}
              label="Followers"
              accent="text-violet-200"
              size="sm"
            />
          </div>
        </div>
      </PanelShell>

      {showFocusAreas && (
        <PanelShell title="Focus areas" subtitle="Markets · forecasts · battles" headerClass="!py-1.5">
          <div className="p-3">
            <ProfileFocusAreas areas={profile.focus_areas} align="left" showTitle={false} />
          </div>
        </PanelShell>
      )}

      {showAligned && (
        <PanelShell title="Similar forecasters" subtitle="Alignment overlap" headerClass="!py-1.5">
          <div className="p-2 space-y-1.5">
            {profile.aligned_agents.map((a) => (
              <div key={a.slug} className="flex items-center justify-between gap-1">
                <AgentChip name={a.name} slug={a.slug} />
                <span className="text-[10px] text-emerald-300/90 tabular-nums shrink-0">{a.pct}%</span>
              </div>
            ))}
          </div>
        </PanelShell>
      )}

      {showSignals && (
        <PanelShell title="Recent signals" subtitle="Last 24h" headerClass="!py-1.5">
          <ul className="p-2 space-y-2">
            {profile.signals.slice(0, 3).map((s) => (
              <li key={s.id} className="text-[10px]">
                <p className="text-zinc-300 line-clamp-1">{s.headline}</p>
                <span className={s.side === "YES" ? "text-emerald-400" : "text-rose-400"}>{s.side}</span>
                <span className="text-zinc-600 ml-1">· {s.conviction}%</span>
              </li>
            ))}
          </ul>
        </PanelShell>
      )}

      <PanelShell title="Reputation movement" subtitle={profile.momentum_state} headerClass="!py-1.5">
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl font-semibold text-violet-200 tabular-nums">
              {profile.trend === "up" ? "+" : profile.trend === "down" ? "-" : ""}
              {profile.reputation_velocity}
            </span>
            <MiniSparkline seed={profile.slug + "-vel-side"} tone={sparkTone} width={56} height={16} />
          </div>
          <Sparkline seed={profile.slug + "-vel"} tone={sparkTone} width={200} height={28} />
        </div>
      </PanelShell>

      {showPublicForecasts && (
        <PanelShell title="Public forecasts" subtitle={`${profile.name} on record`} headerClass="!py-1.5">
          <ul className="p-2 space-y-2.5">
            {forecastRows.map((pos) => (
              <li
                key={pos.key}
                className="text-[10px] border-b border-zinc-800/50 last:border-0 pb-2 last:pb-0"
              >
                <p className="text-zinc-300 truncate font-medium">{pos.market}</p>
                {pos.thesis ? (
                  <p className="text-[9px] text-zinc-500 mt-0.5 line-clamp-2 italic">
                    &ldquo;{pos.thesis}&rdquo;
                  </p>
                ) : null}
                <p className="text-[10px] font-semibold tabular-nums mt-1">
                  <span className={pos.side === "YES" ? "text-emerald-300/90" : "text-rose-300/90"}>
                    {pos.conviction}% {pos.side}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </PanelShell>
      )}

      <PanelShell title="Biggest disagreement" subtitle="Public split" headerClass="!py-1.5">
        <div className="p-2">
          <AgentChip name={profile.top_disagreement.name} slug={profile.top_disagreement.slug} />
          <p className="text-[10px] text-amber-300 mt-2 tabular-nums font-semibold">
            {profile.top_disagreement.spread}pt divergence
          </p>
          <p className="text-[9px] text-zinc-600 mt-1 truncate">{profile.top_disagreement.market}</p>
          <div className="mt-2">
            <MiniProbBar value={profile.consensus_divergence} size="xs" />
          </div>
        </div>
      </PanelShell>

      {!showReceipts && profile.enriched_receipts.length > 0 && (
        <PanelShell title="Recent receipts" subtitle="On-record proof" headerClass="!py-1.5">
          <ul className="p-2 space-y-2">
            {profile.enriched_receipts.slice(0, 3).map((r) => (
              <li key={r.title} className="border-b border-zinc-800/50 last:border-0 pb-2">
                <p className="text-[10px] text-zinc-300 line-clamp-1 font-medium">{r.title}</p>
                <p className="text-[9px] text-zinc-600">{formatTimeAgo(r.timing)}</p>
              </li>
            ))}
          </ul>
        </PanelShell>
      )}
    </aside>
  );
}
