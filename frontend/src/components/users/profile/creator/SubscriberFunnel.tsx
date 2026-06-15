"use client";

import type { CreatorDashboardStats } from "@/lib/creatorDashboard";

function funnelWidthPct(value: number, max: number): number {
  if (max <= 0) return 12;
  return Math.max(14, Math.min(100, Math.round((value / max) * 100)));
}

function formatStageValue(stage: "credibility" | "followers" | "subscribers", n: number): string {
  if (stage === "credibility") return n.toLocaleString();
  return n.toLocaleString();
}

export function SubscriberFunnel({
  funnel,
}: {
  funnel: CreatorDashboardStats["funnel"];
}) {
  const max = Math.max(funnel.credibility, funnel.followers, funnel.subscribers, 1);

  const stages = [
    {
      key: "credibility" as const,
      label: "Credibility",
      value: funnel.credibility,
      tone: "from-violet-600/90 via-violet-500/75 to-violet-400/60",
      border: "border-violet-500/25",
    },
    {
      key: "followers" as const,
      label: "Followers",
      value: funnel.followers,
      tone: "from-cyan-600/85 via-sky-500/70 to-cyan-400/55",
      border: "border-cyan-500/20",
    },
    {
      key: "subscribers" as const,
      label: "Subscribers",
      value: funnel.subscribers,
      tone: "from-amber-600/85 via-amber-500/70 to-amber-400/55",
      border: "border-amber-500/20",
    },
  ];

  return (
    <div className="space-y-2">
      {stages.map((stage, i) => {
        const width = funnelWidthPct(stage.value, max);
        return (
          <div key={stage.key}>
            {i > 0 && (
              <div className="flex justify-center py-0.5" aria-hidden>
                <span className="text-[10px] text-zinc-700">↓</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-[10px] text-zinc-400">{stage.label}</span>
              <span className="text-sm font-semibold text-zinc-100 tabular-nums">
                {formatStageValue(stage.key, stage.value)}
              </span>
            </div>
            <div className="flex justify-center">
              <div
                className={`h-9 rounded-lg border ${stage.border} bg-gradient-to-r ${stage.tone} flex items-center justify-center transition-all duration-500`}
                style={{ width: `${width}%` }}
              >
                <span className="text-[9px] font-medium text-white/90 uppercase tracking-wider">
                  {stage.label}
                </span>
              </div>
            </div>
          </div>
        );
      })}
      <p className="text-[10px] text-zinc-600 pt-2 border-t border-zinc-800/60">
        Credibility earns attention. Attention converts into supporters who fund your intelligence
        layer.
      </p>
    </div>
  );
}
