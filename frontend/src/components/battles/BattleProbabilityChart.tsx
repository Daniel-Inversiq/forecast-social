"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/feed/shared";
import { formatRelativeTime } from "@/lib/relativeTime";
import {
  BATTLE_NARRATIVE_LABEL,
  BATTLE_NARRATIVE_STYLE,
  buildBattleChartMarkers,
  buildBattleProbHistory,
  type BattleChartMarker,
} from "./battleChartNarratives";
import { battlePricesFromCrowd } from "./battleTradeMath";
import type { EnrichedBattle } from "./types";

const CHART_W = 800;
const CHART_H = 260;
const PADDING = { top: 28, bottom: 32, left: 8, right: 8 };

type PlacedMarker = BattleChartMarker & { x: number; y: number; lane: number };

function MarkerTooltip({ marker }: { marker: PlacedMarker }) {
  const style = BATTLE_NARRATIVE_STYLE[marker.kind];
  return (
    <div
      className="pointer-events-none z-30 w-[min(220px,calc(100vw-2rem))] rounded-lg border border-zinc-700/80 bg-zinc-900/98 shadow-xl p-2.5"
      role="tooltip"
    >
      <div className="flex items-start gap-2">
        <Avatar name={marker.agentName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-zinc-100 truncate">{marker.agentName}</p>
          <p className={`text-[9px] font-medium uppercase tracking-wider ${style.label}`}>
            {BATTLE_NARRATIVE_LABEL[marker.kind]}
          </p>
        </div>
      </div>
      <p className="text-[10px] text-zinc-300 mt-2 leading-snug">{marker.detail}</p>
      <p className="text-[9px] text-zinc-600 mt-1 tabular-nums">{formatRelativeTime(marker.at)}</p>
      <Link
        href={`/agents/${marker.agentSlug}`}
        className="pointer-events-auto mt-2 inline-block text-[10px] text-violet-400/90 hover:text-violet-300"
      >
        View agent →
      </Link>
    </div>
  );
}

export function BattleProbabilityChart({ battle }: { battle: EnrichedBattle }) {
  const prices = battlePricesFromCrowd(battle);
  const currentA = prices.agentACents;
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const history = useMemo(
    () => buildBattleProbHistory(battle, currentA),
    [battle, currentA],
  );

  const narrativeMarkers = useMemo(
    () => buildBattleChartMarkers(battle, history),
    [battle, history],
  );

  const chart = useMemo(() => {
    const innerW = CHART_W - PADDING.left - PADDING.right;
    const innerH = CHART_H - PADDING.top - PADDING.bottom;
    const min = Math.min(...history) - 8;
    const max = Math.max(...history) + 8;
    const range = max - min || 1;

    const points = history.map((p, i) => {
      const x = PADDING.left + (i / Math.max(1, history.length - 1)) * innerW;
      const y = PADDING.top + innerH - ((p - min) / range) * innerH;
      return { x, y, p };
    });

    const pathD = points
      .map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
      .join(" ");

    const last = points[points.length - 1];
    const first = points[0];
    const fillD = last
      ? `${pathD} L${last.x},${PADDING.top + innerH} L${first?.x ?? PADDING.left},${PADDING.top + innerH} Z`
      : "";

    const laneByIndex = new Map<number, number>();
    const placed: PlacedMarker[] = narrativeMarkers.map((m) => {
      const pt = points[Math.min(m.historyIndex, points.length - 1)] ?? points[0];
      const lane = laneByIndex.get(m.historyIndex) ?? 0;
      laneByIndex.set(m.historyIndex, lane + 1);
      return {
        ...m,
        x: pt?.x ?? PADDING.left,
        y: (pt?.y ?? PADDING.top) - lane * 16,
        lane,
      };
    });

    return { pathD, fillD, placed, points, yMin: min, yMax: max };
  }, [history, narrativeMarkers]);

  const lineColor = "rgba(244, 63, 94, 0.92)";

  return (
    <section className="rounded-xl border border-zinc-800/70 bg-zinc-950/80 overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-3 sm:px-4 py-2.5 border-b border-zinc-800/60">
        <div>
          <h2 className="text-[12px] font-semibold text-zinc-200">Battle timeline</h2>
          <p className="text-[10px] text-zinc-600 mt-0.5">
            {battle.agent_a.name} network share · narrative markers
          </p>
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-1 text-[9px] text-zinc-600">
          {(Object.keys(BATTLE_NARRATIVE_LABEL) as Array<keyof typeof BATTLE_NARRATIVE_LABEL>).map(
            (kind) => {
              const style = BATTLE_NARRATIVE_STYLE[kind];
              return (
                <span key={kind} className="inline-flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                  {BATTLE_NARRATIVE_LABEL[kind]}
                </span>
              );
            },
          )}
        </div>
      </div>

      <div className="relative px-2 sm:px-3 py-3 sm:py-4">
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="w-full h-[200px] sm:h-[240px]"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Battle probability chart, ${battle.agent_a.name} at ${currentA}%`}
        >
          <defs>
            <linearGradient id={`battle-prob-fill-${battle.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(244,63,94,0.18)" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>

          {[25, 50, 75].map((pct) => {
            const y =
              PADDING.top +
              (CHART_H - PADDING.top - PADDING.bottom) -
              ((pct - chart.yMin) / (chart.yMax - chart.yMin || 1)) *
                (CHART_H - PADDING.top - PADDING.bottom);
            return (
              <g key={pct}>
                <line
                  x1={PADDING.left}
                  y1={y}
                  x2={CHART_W - PADDING.right}
                  y2={y}
                  stroke="rgba(63,63,70,0.35)"
                  strokeDasharray="4 4"
                />
                <text x={PADDING.left + 2} y={y - 4} fill="rgba(113,113,122,0.7)" fontSize="10">
                  {pct}%
                </text>
              </g>
            );
          })}

          {chart.fillD && (
            <path d={chart.fillD} fill={`url(#battle-prob-fill-${battle.id})`} />
          )}

          <path
            d={chart.pathD}
            fill="none"
            stroke={lineColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {chart.placed.map((m) => {
            const style = BATTLE_NARRATIVE_STYLE[m.kind];
            const active = hoveredId === m.id;
            return (
              <g key={m.id} opacity={hoveredId && !active ? 0.5 : 1}>
                <circle cx={m.x} cy={m.y} r={active ? 6 : 5} fill={style.svgFill} />
                <circle
                  cx={m.x}
                  cy={m.y}
                  r={active ? 10 : 8}
                  fill="none"
                  stroke={style.svgRing}
                  strokeWidth="1.5"
                  opacity={active ? 0.7 : 0.35}
                />
              </g>
            );
          })}
        </svg>

        <div className="absolute inset-0 px-2 sm:px-3 py-3 sm:py-4 pointer-events-none">
          {chart.placed.map((m) => {
            const leftPct = (m.x / CHART_W) * 100;
            const topPct = (m.y / CHART_H) * 100;
            const style = BATTLE_NARRATIVE_STYLE[m.kind];
            const active = hoveredId === m.id;
            return (
              <div
                key={m.id}
                className="absolute pointer-events-auto"
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  transform: "translate(-50%, -50%)",
                }}
                onMouseEnter={() => setHoveredId(m.id)}
                onMouseLeave={() => setHoveredId((id) => (id === m.id ? null : id))}
              >
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-full scry-tap-target"
                  aria-label={m.headline}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full shrink-0 ring-2 ${style.dot} ${style.ring}`}
                  />
                  <span className={`hidden md:inline text-[9px] font-medium truncate max-w-[96px] ${style.label}`}>
                    {BATTLE_NARRATIVE_LABEL[m.kind]}
                  </span>
                </button>
                {active && (
                  <div
                    className={`absolute z-30 ${
                      leftPct > 65 ? "right-0" : leftPct < 30 ? "left-0" : "left-1/2 -translate-x-1/2"
                    } ${topPct < 32 ? "top-full mt-2" : "bottom-full mb-2"}`}
                  >
                    <MarkerTooltip marker={m} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <ul className="mt-2 space-y-1.5 px-1 md:hidden" aria-label="Battle narrative markers">
          {chart.placed.map((m) => {
            const style = BATTLE_NARRATIVE_STYLE[m.kind];
            return (
              <li key={`m-${m.id}`} className="flex items-center gap-2 text-[10px] min-w-0">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${style.dot}`} />
                <span className={`truncate ${style.label}`}>{m.headline}</span>
                <span className="text-zinc-600 shrink-0 tabular-nums ml-auto">
                  {formatRelativeTime(m.at, true)}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="flex justify-between text-[10px] text-zinc-600 px-1 mt-2">
          <span>7d ago</span>
          <span className="text-zinc-500 truncate max-w-[45%] text-center hidden sm:inline">
            {battle.momentum.label} · {battle.agent_b.name} {prices.agentBCents}%
          </span>
          <span className="tabular-nums">
            Now · {battle.agent_a.name} {currentA}%
          </span>
        </div>
      </div>
    </section>
  );
}
