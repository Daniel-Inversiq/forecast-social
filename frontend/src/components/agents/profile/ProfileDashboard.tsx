"use client";

import { MiniProbBar, MiniSparkline } from "@/components/feed/shared";
import { ProfileFocusAreas } from "@/components/profile/ProfileFocusAreas";
import { LabeledMetric } from "@/components/metrics/LabeledMetric";
import { MiniConvictionGraph } from "@/components/agents/MiniConvictionGraph";
import { Sparkline } from "@/components/agents/Sparkline";
import { ProfileCalibrationModule } from "./ProfileCalibrationModule";
import { ProfileMilestoneTimeline } from "./ProfileMilestoneTimeline";
import { ProfileMilestonesModule } from "./ProfileMilestonesModule";
import { ProfileFeaturedMarksEditor } from "./ProfileFeaturedMarksEditor";
import { ProfileReputationCabinet } from "./ProfileReputationCabinet";
import { ProfileReputationCurve } from "./ProfileReputationCurve";
import { ProfileReputationTimeline } from "./ProfileReputationTimeline";
import { ProfileTimingModule } from "./ProfileTimingModule";
import { ProfileVelocityIndicator } from "./ProfileVelocityIndicator";
import { TrustProgressWidget } from "@/components/trust/TrustProgressWidget";
import { buildAgentTrustProgress } from "@/lib/trustProgress";
import { useMemo } from "react";
import type { EnrichedAgentProfile } from "./types";

export function ProfileDashboard({
  profile,
  onFeaturedMarksUpdated,
  featuredMarksEndpoint = "agent",
  hideFeaturedMarksEditor = false,
  showTrustProgress = true,
}: {
  profile: EnrichedAgentProfile;
  onFeaturedMarksUpdated?: (
    keys: string[],
    marks: import("@/lib/reputation").ReputationMark[],
  ) => void;
  featuredMarksEndpoint?: "agent" | "user";
  hideFeaturedMarksEditor?: boolean;
  /** Trust tier requirements belong in settings / reputation hub, not public profile */
  showTrustProgress?: boolean;
}) {
  const sparkTone =
    profile.trend === "up" ? "emerald" : profile.trend === "down" ? "amber" : "violet";
  const earlyPct = profile.early_call_pct;
  const consensusPct = 100 - profile.consensus_divergence;
  const live = profile.has_live_reputation;
  const trustProgress = useMemo(() => buildAgentTrustProgress(profile), [profile]);

  return (
    <div className="space-y-3">
      {showTrustProgress && <TrustProgressWidget data={trustProgress} />}
      {live && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <ProfileVelocityIndicator profile={profile} />
          <ProfileTimingModule profile={profile} />
          <div className="md:col-span-2 xl:col-span-2">
            <ProfileCalibrationModule profile={profile} />
          </div>
        </div>
      )}

      {live && (
        <>
          {!hideFeaturedMarksEditor && (
            <ProfileFeaturedMarksEditor
              slug={profile.slug}
              reputation={profile.reputation}
              onUpdated={onFeaturedMarksUpdated}
              endpoint={featuredMarksEndpoint}
            />
          )}
          <ProfileReputationCabinet reputation={profile.reputation} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ProfileMilestoneTimeline profile={profile} />
            <ProfileMilestonesModule profile={profile} />
          </div>
          <ProfileReputationTimeline profile={profile} />
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <div className="md:col-span-2 xl:col-span-2 rounded-xl border border-zinc-800/85 bg-zinc-950/90 p-3 sm:p-4 feed-hover-lift">
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-2">
            Reputation curve {live && <span className="text-violet-400/80">· live</span>}
          </p>
          {live && profile.reputation_sparkline && profile.reputation_sparkline.length >= 2 ? (
            <ProfileReputationCurve profile={profile} />
          ) : (
            <Sparkline seed={profile.slug + "-dash-curve"} tone={sparkTone} width={480} height={56} />
          )}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2 py-2">
              <LabeledMetric
                value={`${profile.signal_quality}%`}
                label="Signal Quality"
                accent="text-violet-200"
                size="sm"
              />
            </div>
            <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2 py-2">
              <LabeledMetric
                value={`${Math.round(profile.timing_quality)}%`}
                label="Timing Quality"
                accent="text-sky-300/90"
                size="sm"
              />
            </div>
            <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2 py-2">
              <LabeledMetric
                value={String(profile.resolved_calls)}
                label="Resolved Forecasts"
                accent="text-zinc-200"
                size="sm"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-violet-500/15 bg-zinc-950/90 p-3 feed-hover-lift">
          <MiniConvictionGraph seed={profile.slug + "-conv"} />
          <p className="text-[9px] text-zinc-500 mt-2">Conviction movement over recent positioning window</p>
        </div>

        <div className="rounded-xl border border-zinc-800/85 bg-zinc-950/90 p-3 feed-hover-lift">
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-2">Accuracy history</p>
          <MiniSparkline seed={profile.slug + "-acc-hist"} tone="emerald" width={200} height={32} />
          <div className="mt-2">
            <LabeledMetric
              value={`${Math.round(profile.reputation?.calibration_score ?? profile.accuracy_score)}%`}
              label="Forecast Accuracy"
              hint="90-day window"
              accent="text-emerald-300/90"
              size="sm"
              className="text-left [&_p]:text-left"
            />
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800/85 bg-zinc-950/90 p-3 feed-hover-lift">
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-2">Market specialization</p>
          <ul className="space-y-2">
            {profile.top_markets.slice(0, 4).map((m) => (
              <li key={m.title} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-zinc-300 truncate">{m.title}</span>
                <span className="text-violet-300 tabular-nums shrink-0">{m.strength}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-zinc-800/85 bg-zinc-950/90 p-3 feed-hover-lift">
          <ProfileFocusAreas areas={profile.focus_areas} align="left" />
        </div>

        <div className="rounded-xl border border-zinc-800/85 bg-zinc-950/90 p-3 feed-hover-lift">
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-2">Agreement / divergence</p>
          <div className="space-y-3">
            <div>
              <p className="text-[8px] text-zinc-600 mb-1">Network alignment</p>
              <MiniProbBar value={profile.agreement_pct} size="xs" />
            </div>
            <div>
              <p className="text-[8px] text-zinc-600 mb-1">Consensus divergence</p>
              <MiniProbBar value={profile.consensus_divergence} size="xs" />
            </div>
          </div>
        </div>

        {!live && (
          <div className="rounded-xl border border-cyan-500/15 bg-zinc-950/90 p-3 feed-hover-lift">
            <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-2">Early vs consensus timing</p>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-sky-300/90">Early signal</span>
                  <span className="text-zinc-500 tabular-nums">{earlyPct}%</span>
                </div>
                <MiniProbBar value={earlyPct} size="xs" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-violet-300/90">Consensus alignment</span>
                  <span className="text-zinc-500 tabular-nums">{consensusPct}%</span>
                </div>
                <MiniProbBar value={consensusPct} size="xs" />
              </div>
            </div>
            <p className="text-[9px] text-zinc-600 mt-2">Reputation velocity · {profile.reputation_velocity}/wk</p>
          </div>
        )}

        {!live && (
          <div className="md:col-span-2 rounded-xl border border-zinc-800/85 bg-zinc-950/90 p-3 feed-hover-lift">
            <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-2">Calibration · category distribution</p>
            <div className="flex flex-wrap gap-4">
              {profile.top_markets.map((m) => (
                <div key={m.title} className="flex-1 min-w-[120px]">
                  <p className="text-[10px] text-zinc-400 truncate mb-1">{m.title}</p>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-600/80 to-sky-500/70 rounded-full"
                      style={{ width: `${m.probability}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-zinc-600 mt-0.5 tabular-nums">{m.probability}% · {m.category}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
