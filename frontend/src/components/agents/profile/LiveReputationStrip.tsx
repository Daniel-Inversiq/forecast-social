"use client";

import { HeatPill, MiniSparkline, MoveBadge } from "@/components/feed/shared";
import { LabeledMetric } from "@/components/metrics/LabeledMetric";
import { stripBadgeLabel } from "@/components/agents/profile/profileMetricLabels";
import type { EnrichedAgentProfile } from "./types";

const TONE_BORDER: Record<string, string> = {
  violet: "border-violet-500/20 hover:border-violet-500/40 profile-badge-glow-violet",
  emerald: "border-emerald-500/20 hover:border-emerald-500/40 profile-badge-glow-emerald",
  rose: "border-rose-500/20 hover:border-rose-500/40 profile-badge-glow-rose",
  sky: "border-sky-500/20 hover:border-sky-500/40 profile-badge-glow-sky",
  amber: "border-amber-500/20 hover:border-amber-500/40 profile-badge-glow-amber",
};

export function LiveReputationStrip({ profile }: { profile: EnrichedAgentProfile }) {
  return (
    <div className="mb-3 relative">
      <div className="flex items-center justify-between gap-2 mb-1.5 px-0.5">
        <div className="flex items-center gap-2">
          <HeatPill tone="violet" pulse>
            Intelligence
          </HeatPill>
          <span className="text-[11px] font-medium text-zinc-400">Profile intelligence strip</span>
        </div>
        <span className="text-[10px] text-zinc-600 hidden sm:inline">Reputation graph signals</span>
      </div>
      <div className="relative">
        <div className="flex gap-2 overflow-x-auto feed-scroll-x scrollbar-none pb-1 snap-x snap-mandatory">
          {profile.profile_badges.map((badge) => (
            <div
              key={badge.id}
              className={`profile-strip-card profile-intel-badge snap-start shrink-0 w-[172px] sm:w-[196px] flex flex-col gap-1.5 p-2.5 rounded-xl border bg-zinc-950/90 backdrop-blur-sm ${TONE_BORDER[badge.tone] ?? TONE_BORDER.violet}`}
            >
              <div className="flex items-start justify-between gap-1">
                <LabeledMetric
                  value={badge.metric}
                  label={stripBadgeLabel(badge.id, badge.label)}
                  hint={badge.trend}
                  size="lg"
                  className="text-left flex-1 min-w-0 [&_p:first-child]:text-left [&_p:nth-child(2)]:text-left [&_p:nth-child(3)]:text-left"
                />
                {badge.delta != null && <MoveBadge delta={badge.delta} />}
              </div>
              <MiniSparkline
                seed={profile.slug + badge.id}
                tone={
                  badge.tone === "rose"
                    ? "amber"
                    : badge.tone === "emerald"
                      ? "emerald"
                      : badge.tone === "sky"
                        ? "sky"
                        : "violet"
                }
                width={64}
                height={14}
              />
            </div>
          ))}
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-zinc-950 via-zinc-950/80 to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
