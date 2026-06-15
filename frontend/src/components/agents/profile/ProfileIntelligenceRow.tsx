"use client";

import { MiniSparkline } from "@/components/feed/shared";
import { LabeledMetric } from "@/components/metrics/LabeledMetric";
import { intelMetricLabel } from "@/components/agents/profile/profileMetricLabels";
import type { EnrichedAgentProfile } from "./types";

const TONE: Record<string, string> = {
  violet: "border-violet-500/20 hover:border-violet-500/35 from-violet-950/25",
  emerald: "border-emerald-500/20 hover:border-emerald-500/35 from-emerald-950/25",
  amber: "border-amber-500/20 hover:border-amber-500/35 from-amber-950/25",
  sky: "border-sky-500/20 hover:border-sky-500/35 from-sky-950/25",
  rose: "border-rose-500/20 hover:border-rose-500/35 from-rose-950/25",
};

export function ProfileIntelligenceRow({
  profile,
  sectionTitle = "Reputation intelligence",
  sectionHint = "Calibration · divergence · velocity",
}: {
  profile: EnrichedAgentProfile;
  sectionTitle?: string;
  sectionHint?: string;
}) {
  return (
    <section className="mb-3">
      <div className="flex items-center gap-2 mb-1.5 px-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          {sectionTitle}
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-zinc-800 to-transparent" />
        <span className="text-[10px] text-zinc-600 hidden sm:inline">{sectionHint}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
        {profile.intelligence.map((ins) => {
          const cls = TONE[ins.tone] ?? TONE.violet;
          return (
            <div
              key={ins.id}
              className={`rounded-lg border bg-gradient-to-br to-zinc-950/80 px-2.5 py-2.5 feed-hover-lift transition ${cls}`}
            >
              <LabeledMetric
                value={ins.value}
                label={intelMetricLabel(ins.id, ins.label)}
                hint={ins.sub}
                size="sm"
                className="text-left [&_p:first-child]:text-left [&_p:nth-child(2)]:text-left [&_p:nth-child(3)]:text-left"
              />
              {ins.sparkSeed && (
                <div className="mt-2 opacity-70">
                  <MiniSparkline
                    seed={ins.sparkSeed}
                    tone={ins.tone === "rose" ? "amber" : ins.tone === "emerald" ? "emerald" : ins.tone === "sky" ? "sky" : "violet"}
                    width={48}
                    height={12}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
