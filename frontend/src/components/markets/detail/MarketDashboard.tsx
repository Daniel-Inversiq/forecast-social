"use client";

import {
  MiniProbBar,
  MiniSparkline,
  NarrativeStrengthBar,
} from "@/components/feed/shared";
import { AgreementMeter } from "@/components/following/AgreementMeter";
import { WhyMarketMovingPanel } from "./WhyMarketMovingPanel";
import type { EnrichedMarketDetail } from "./types";

function AlignmentHeatmap({ market }: { market: EnrichedMarketDetail }) {
  const cells = market.agent_takes.slice(0, 12);
  while (cells.length < 8) {
    cells.push({
      name: "—",
      slug: "x",
      side: "YES",
      confidence: 50,
      reasoning: "",
    });
  }

  return (
    <div className="grid grid-cols-4 gap-1">
      {cells.slice(0, 8).map((t, i) => {
        const intensity = Math.min(100, Math.max(15, t.confidence));
        const isYes = t.side === "YES";
        return (
          <div
            key={`${t.slug}-${i}`}
            className="rounded-md border border-zinc-800/60 p-1.5 text-center"
            style={{
              background: isYes
                ? `rgba(139,92,246,${intensity / 200})`
                : `rgba(63,63,70,${intensity / 150})`,
            }}
            title={`${t.name}: ${t.side} ${Math.round(t.confidence)}%`}
          >
            <p className="text-[7px] text-zinc-500 truncate">{t.name.split(" ")[0]}</p>
            <p className={`text-[9px] font-bold tabular-nums ${isYes ? "text-violet-300" : "text-zinc-400"}`}>
              {Math.round(t.confidence)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function ProbabilityCurvePanel({ market }: { market: EnrichedMarketDetail }) {
  const w = 400;
  const h = 80;
  const pts = market.prob_history;
  const min = Math.min(...pts) - 2;
  const max = Math.max(...pts) + 2;
  const range = max - min || 1;
  const step = w / (pts.length - 1);
  const d = pts
    .map((p, i) => {
      const x = i * step;
      const py = h - ((p - min) / range) * (h - 8) - 4;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold text-zinc-300">Probability curve</p>
        <span className="text-[9px] text-zinc-600 tabular-nums">12-period repricing</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20" preserveAspectRatio="none">
        <defs>
          <linearGradient id="dash-prob" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(139,92,246,0.25)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <path d={`${d} L${w},${h} L0,${h} Z`} fill="url(#dash-prob)" />
        <path d={d} fill="none" stroke="rgba(167,139,250,0.85)" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

export function MarketDashboard({ market }: { market: EnrichedMarketDetail }) {
  const yesPct = Math.round(
    (market.yes_count / Math.max(1, market.yes_count + market.no_count)) * 100,
  );

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/90 overflow-hidden mb-3">
      <div className="px-3 py-2.5 border-b border-zinc-800/70 bg-gradient-to-r from-violet-950/35 via-zinc-950 to-zinc-950">
        <h2 className="text-xs font-semibold text-white">Market intelligence dashboard</h2>
        <p className="text-[10px] text-zinc-600 mt-0.5">
          Conviction trend · alignment · fragmentation · signal acceleration
        </p>
      </div>

      <div className="p-3 space-y-3">
        <WhyMarketMovingPanel why={market.why_moving} />
        <ProbabilityCurvePanel market={market} />

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-3">
            <p className="text-[10px] font-semibold text-zinc-300 mb-2">Conviction trend</p>
            <MiniProbBar value={market.current_yes_probability} size="sm" hoverBoost />
            <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed">{market.why_moved}</p>
            <div className="mt-2 flex items-center gap-2">
              <MiniSparkline seed={market.slug + "-trend"} tone="emerald" width={56} height={14} />
              <span className="text-[9px] text-zinc-600">
                {market.enriched.sentiment === "split" ? "Fragmented" : market.enriched.sentiment} drift
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-3">
            <p className="text-[10px] font-semibold text-zinc-300 mb-2">Agent positioning</p>
            <div className="flex items-center justify-between text-[10px] mb-2">
              <span className="text-violet-300 tabular-nums">{market.yes_count} YES</span>
              <span className="text-zinc-500 tabular-nums">{market.no_count} NO</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden flex bg-zinc-800">
              <div
                className="h-full bg-gradient-to-r from-violet-600/90 to-violet-500/60"
                style={{ width: `${yesPct}%` }}
              />
              <div className="h-full flex-1 bg-zinc-700/80" />
            </div>
            <AgreementMeter
              agree={100 - market.consensus_fragmentation}
              label="Crowd alignment"
              compact
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-3">
            <p className="text-[10px] font-semibold text-zinc-300 mb-2">Momentum analysis</p>
            <NarrativeStrengthBar
              strength={market.conviction_velocity}
              accelerating={market.momentum === "up"}
              label="Conviction velocity"
            />
            <p className="text-[9px] text-zinc-600 mt-2">
              Cluster: {market.enriched.narrative_cluster}
            </p>
          </div>

          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-3">
            <p className="text-[10px] font-semibold text-zinc-300 mb-2">Signal acceleration</p>
            <NarrativeStrengthBar
              strength={market.narrative_velocity}
              accelerating={market.urgency === "hot"}
              label="Narrative velocity"
            />
          </div>

          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-3 sm:col-span-2 lg:col-span-1">
            <p className="text-[10px] font-semibold text-zinc-300 mb-2">Consensus fragmentation</p>
            <p className="text-2xl font-semibold text-amber-300/90 tabular-nums">
              {market.consensus_fragmentation}%
            </p>
            <p className="text-[9px] text-zinc-600 mt-1">Disagreement spread across agents</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-3">
            <p className="text-[10px] font-semibold text-zinc-300 mb-2">Alignment map</p>
            <AlignmentHeatmap market={market} />
          </div>
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-3">
            <p className="text-[10px] font-semibold text-zinc-300 mb-2">Reputation exposure</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-semibold text-amber-300/90 tabular-nums">
                {market.reputation_exposure}%
              </span>
              <MiniSparkline
                seed={market.slug + "-rep"}
                tone="amber"
                width={48}
                height={16}
              />
            </div>
            <p className="text-[9px] text-zinc-600 mt-2">
              {market.enriched.receipts_count} verified calls · {market.enriched.reputation_conflict} conflict
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
