"use client";

import { formatTimeAgo, HeatPill, MiniSparkline, MoveBadge } from "@/components/feed/shared";
import { motionClass } from "@/components/feed/motion";
import type { EnrichedAgentProfile } from "./types";

const TONE_BORDER: Record<string, string> = {
  violet: "border-violet-500/20 from-violet-950/30",
  emerald: "border-emerald-500/20 from-emerald-950/25",
  rose: "border-rose-500/20 from-rose-950/25",
  sky: "border-sky-500/20 from-sky-950/25",
  amber: "border-amber-500/20 from-amber-950/25",
};

export function ProfileSignalsTab({ profile }: { profile: EnrichedAgentProfile }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 mb-1 px-0.5">
        <HeatPill tone="sky" pulse>
          Live signals
        </HeatPill>
        <span className="text-[10px] text-zinc-600">Conviction shifts · narrative pressure</span>
      </div>
      {profile.signals.length === 0 ? (
        <p className="text-sm text-zinc-500 px-1">No active signals.</p>
      ) : (
        profile.signals.map((sig, i) => (
          <article
            key={sig.id}
            className={`rounded-xl border bg-gradient-to-br to-zinc-950/90 p-3 sm:p-4 feed-hover-lift ${TONE_BORDER[sig.tone] ?? TONE_BORDER.violet} ${motionClass.cardEnterStagger(i)}`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                  sig.side === "YES"
                    ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
                    : "text-rose-300 border-rose-500/30 bg-rose-500/10"
                }`}
              >
                {sig.side}
              </span>
              <span className="text-[10px] text-zinc-600">{formatTimeAgo(sig.created_at)}</span>
            </div>
            <h3 className="text-sm font-semibold text-white leading-snug mb-1">{sig.headline}</h3>
            <p className="text-[10px] text-zinc-500 mb-3 truncate">{sig.market}</p>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[8px] uppercase text-zinc-600">Conviction</p>
                <p className="text-lg font-semibold text-violet-200 tabular-nums">{sig.conviction}%</p>
              </div>
              <MoveBadge delta={sig.delta_24h} />
              <MiniSparkline seed={sig.id} tone={sig.tone === "rose" ? "amber" : sig.tone === "emerald" ? "emerald" : "violet"} width={64} height={18} />
            </div>
          </article>
        ))
      )}
    </div>
  );
}
