"use client";

import type { NetworkCluster } from "./types";
import { AgreementMeter } from "./AgreementMeter";
import { HeatPill } from "@/components/feed/shared";

const TONE_STYLES: Record<
  NetworkCluster["tone"],
  { border: string; gradient: string; pill: "violet" | "sky" | "rose" | "emerald" | "amber" }
> = {
  violet: {
    border: "border-violet-500/25 hover:border-violet-500/40",
    gradient: "from-violet-950/40",
    pill: "violet",
  },
  sky: {
    border: "border-sky-500/25 hover:border-sky-500/40",
    gradient: "from-sky-950/35",
    pill: "sky",
  },
  rose: {
    border: "border-rose-500/25 hover:border-rose-500/40",
    gradient: "from-rose-950/35",
    pill: "rose",
  },
  emerald: {
    border: "border-emerald-500/25 hover:border-emerald-500/40",
    gradient: "from-emerald-950/30",
    pill: "emerald",
  },
  amber: {
    border: "border-amber-500/25 hover:border-amber-500/40",
    gradient: "from-amber-950/35",
    pill: "amber",
  },
};

const DIR_LABEL: Record<NetworkCluster["direction"], string> = {
  bullish: "Bullish drift",
  bearish: "Bearish drift",
  split: "Sharp disagreement",
  neutral: "Watching",
};

export function NetworkClusterCard({ cluster }: { cluster: NetworkCluster }) {
  const style = TONE_STYLES[cluster.tone];

  return (
    <article
      className={`relative shrink-0 w-[200px] sm:w-[220px] rounded-xl border bg-zinc-950/90 overflow-hidden feed-hover-lift feed-card-glow ${style.border}`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-16 bg-gradient-to-b ${style.gradient} to-transparent pointer-events-none`}
      />
      <div className="relative p-2.5">
        <div className="flex items-center gap-1.5 mb-2">
          <HeatPill tone={style.pill} pulse>
            Cluster
          </HeatPill>
          <span className="text-[9px] text-zinc-600 truncate">{DIR_LABEL[cluster.direction]}</span>
        </div>
        <h3 className="text-[11px] font-semibold text-white mb-0.5">{cluster.label}</h3>
        <p className="text-[9px] text-zinc-500 line-clamp-1 mb-2">{cluster.narrative}</p>
        <AgreementMeter
          agree={cluster.agreement}
          label="Network alignment"
          compact
        />
        <p className="text-[9px] text-zinc-600 mt-2 truncate">
          {cluster.agents.slice(0, 3).join(", ")}
          {cluster.agents.length > 3 ? ` +${cluster.agents.length - 3}` : ""}
        </p>
      </div>
    </article>
  );
}
