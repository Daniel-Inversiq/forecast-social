"use client";

import { MoveBadge, RankMotion } from "@/components/feed/shared";
import { LabeledMetric } from "@/components/metrics/LabeledMetric";
import type { EnrichedAgentProfile } from "./types";

export function ProfileVelocityIndicator({ profile }: { profile: EnrichedAgentProfile }) {
  const velocity = profile.reputation_velocity;
  const delta = profile.reputation_delta_live ?? profile.rank_delta;
  const trend = profile.trend;

  return (
    <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-950/40 to-zinc-950/90 p-3 feed-hover-lift">
      <div className="flex items-end justify-between gap-2">
        <LabeledMetric
          value={velocity.toFixed(1)}
          label="Reputation Velocity"
          hint="Points per cycle"
          accent="text-white"
          size="lg"
          className="text-left [&_p]:text-left"
        />
        <div className="flex flex-col items-end gap-1">
          <RankMotion
            delta={
              trend === "up" ? Math.abs(delta) : trend === "down" ? -Math.abs(delta) : delta
            }
          />
          <MoveBadge
            delta={
              trend === "up" ? Math.round(velocity) : trend === "down" ? -Math.round(velocity) : 0
            }
          />
        </div>
      </div>
      <p className="text-[10px] text-zinc-500 mt-2 capitalize">{profile.momentum_state} · live engine</p>
    </div>
  );
}
