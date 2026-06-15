"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/feed/shared";
import { formatRelativeTime } from "@/lib/relativeTime";
import {
  buildMarketChartMarkers,
  NARRATIVE_KIND_STYLE,
  type ChartNarrativeMarker,
} from "./marketChartNarratives";
import {
  buildAgentPositionMarkers,
  buildCredibilityHistory,
  buildMarketActivitySeries,
  buildNarrativeInfluenceHistory,
  buildProbHistorySeries,
  CHART_TIME_RANGES,
  formatChartTimestamp,
  formatRangeAxisLabel,
  formatVolume,
  mapGlobalIndexToSlice,
  sliceHistoryForRange,
  type AgentPositionMarker,
  type ChartTimeRange,
} from "./marketChartData";
import { buildNarrativeDrivers } from "./marketNarrativeInsights";
import {
  areaPathUnderLine,
  indexFromPointerX,
  smoothLinePath,
  type ChartPoint,
} from "./marketChartPaths";
import type { EnrichedMarketDetail } from "./types";

export type ChartMode = "market" | "narrative";

const CHART_W = 960;
const CHART_H = 480;
const PADDING = { top: 20, bottom: 40, left: 48, right: 20 };
const Y_MIN = 0;
const Y_MAX = 100;
const YES_COLOR = "rgba(52,211,153,0.98)";
const NO_COLOR = "rgba(251,113,133,0.92)";
const YES_FILL = "rgba(52,211,153,0.16)";
const NO_FILL = "rgba(251,113,133,0.08)";
const YES_MUTED = "rgba(52,211,153,0.32)";
const INFLUENCE_COLOR = "rgba(167,139,250,0.75)";
const CRED_COLOR = "rgba(161,161,170,0.55)";

type PlacedNarrative = ChartNarrativeMarker & { x: number; y: number; lane: number };
type PlacedAgent = AgentPositionMarker & { x: number; y: number };

function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition scry-tap-target ${
        active
          ? "bg-zinc-100 text-zinc-950"
          : "bg-zinc-900/80 text-zinc-500 hover:text-zinc-300 border border-zinc-800/80"
      }`}
    >
      {children}
    </button>
  );
}

function ModeSwitch({
  mode,
  onChange,
}: {
  mode: ChartMode;
  onChange: (mode: ChartMode) => void;
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-0.5"
      role="tablist"
      aria-label="Chart mode"
    >
      {(
        [
          { id: "market" as const, label: "Market" },
          { id: "narrative" as const, label: "Narrative" },
        ] as const
      ).map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={mode === id}
          onClick={() => onChange(id)}
          className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition scry-tap-target ${
            mode === id
              ? "bg-zinc-100 text-zinc-950 shadow-sm"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function NarrativeThesisPanel({
  marker,
  onClose,
}: {
  marker: ChartNarrativeMarker;
  onClose: () => void;
}) {
  const style = NARRATIVE_KIND_STYLE[marker.kind];
  return (
    <div className="mt-3 rounded-lg border border-zinc-800/80 bg-zinc-900/60 px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[12px] font-semibold ${style.label}`}>{marker.headline}</p>
          <p className="text-[10px] text-zinc-600 mt-0.5 tabular-nums">
            {formatRelativeTime(marker.at)}
            {marker.agentName !== "Network" && (
              <>
                {" "}
                ·{" "}
                <Link
                  href={`/agents/${marker.agentSlug}`}
                  className="text-violet-400/90 hover:text-violet-300"
                >
                  {marker.agentName}
                </Link>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] text-zinc-600 hover:text-zinc-400 shrink-0 scry-tap-target"
          aria-label="Close event detail"
        >
          Close
        </button>
      </div>
      <p className="text-[12px] text-zinc-300 leading-relaxed mt-2">{marker.thesis}</p>
      <p className="text-[10px] text-zinc-500 mt-2">{marker.impact}</p>
    </div>
  );
}

function ChartHoverTooltip({
  leftPct,
  topPct,
  timestamp,
  yes,
  no,
  volume,
  participation,
  leadingForecaster,
}: {
  leftPct: number;
  topPct: number;
  timestamp: string;
  yes: number;
  no: number;
  volume: string;
  participation: number;
  leadingForecaster: string;
}) {
  const flip = leftPct > 62;
  return (
    <div
      className="pointer-events-none absolute z-20 min-w-[168px] rounded-lg border border-zinc-700/80 bg-zinc-950/95 px-3 py-2.5 shadow-xl backdrop-blur-sm"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: flip ? "translate(-108%, -110%)" : "translate(8px, -110%)",
      }}
    >
      <p className="text-[11px] font-medium text-zinc-300 tabular-nums">{timestamp}</p>
      <div className="mt-2 space-y-1">
        <p className="text-[12px] font-semibold text-emerald-400 tabular-nums">
          YES {Math.round(yes)}%
        </p>
        <p className="text-[12px] font-semibold text-rose-400 tabular-nums">
          NO {Math.round(no)}%
        </p>
      </div>
      <div className="mt-2 pt-2 border-t border-zinc-800/80 space-y-0.5">
        <p className="text-[10px] text-zinc-500">
          Volume <span className="text-zinc-300 tabular-nums">{volume}</span>
        </p>
        <p className="text-[10px] text-zinc-500">
          Active forecasters:{" "}
          <span className="text-zinc-300 tabular-nums">{participation}</span>
        </p>
        <p className="text-[10px] text-zinc-500">
          Leading forecaster:{" "}
          <span className="text-violet-300/90">{leadingForecaster}</span>
        </p>
      </div>
    </div>
  );
}

function EventHoverTooltip({
  marker,
  leftPct,
  topPct,
}: {
  marker: ChartNarrativeMarker;
  leftPct: number;
  topPct: number;
}) {
  const style = NARRATIVE_KIND_STYLE[marker.kind];
  const flip = leftPct > 58;
  return (
    <div
      className="pointer-events-none absolute z-30 max-w-[220px] rounded-lg border border-zinc-700/80 bg-zinc-950/95 px-3 py-2 shadow-xl backdrop-blur-sm"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: flip ? "translate(-105%, -120%)" : "translate(8px, -120%)",
      }}
    >
      <p className={`text-[11px] font-semibold ${style.label}`}>{marker.headline}</p>
      <p className="text-[10px] text-zinc-500 mt-0.5 tabular-nums">
        {formatChartTimestamp(new Date(marker.at).getTime())}
        {marker.agentName !== "Network" && ` · ${marker.agentName}`}
      </p>
      <p className="text-[10px] text-zinc-400 mt-1.5 leading-snug line-clamp-3">{marker.thesis}</p>
      <p className="text-[10px] text-zinc-600 mt-1">{marker.impact}</p>
    </div>
  );
}

export function MarketProbabilityChart({
  market,
  compactToolbar = false,
}: {
  market: EnrichedMarketDetail;
  compactToolbar?: boolean;
}) {
  const yesProb = Math.round(market.current_yes_probability);
  const noProb = 100 - yesProb;
  const leadingForecaster = useMemo(
    () => buildNarrativeDrivers(market)[0]?.name ?? market.bullish_agent?.name ?? "Macro Oracle",
    [market],
  );

  const [mode, setMode] = useState<ChartMode>("market");
  const [timeRange, setTimeRange] = useState<ChartTimeRange>("3M");
  const [showVolume, setShowVolume] = useState(false);
  const [showParticipation, setShowParticipation] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);

  const chartAreaRef = useRef<HTMLDivElement>(null);

  const fullSeries = useMemo(() => buildProbHistorySeries(market), [market]);
  const series = useMemo(
    () => sliceHistoryForRange(fullSeries, timeRange),
    [fullSeries, timeRange],
  );
  const narrativeMarkers = useMemo(() => buildMarketChartMarkers(market), [market]);
  const agentMarkers = useMemo(() => buildAgentPositionMarkers(market), [market]);
  const activitySeries = useMemo(
    () => buildMarketActivitySeries(market, series),
    [market, series],
  );

  const chart = useMemo(() => {
    const innerW = CHART_W - PADDING.left - PADDING.right;
    const innerH = CHART_H - PADDING.top - PADDING.bottom;
    const len = series.length;
    const activityH = mode === "market" && (showVolume || showParticipation) ? 40 : 0;
    const probH = innerH - activityH;

    const toY = (p: number, bandH = probH) =>
      PADDING.top + bandH - ((p - Y_MIN) / (Y_MAX - Y_MIN)) * bandH;

    const toX = (i: number) => PADDING.left + (i / Math.max(1, len - 1)) * innerW;

    const yesPoints: ChartPoint[] = series.map((pt, i) => ({
      x: toX(i),
      y: toY(pt.yes),
    }));
    const noPoints: ChartPoint[] = series.map((pt, i) => ({
      x: toX(i),
      y: toY(pt.no),
    }));

    const yesPath = smoothLinePath(yesPoints);
    const noPath = smoothLinePath(noPoints);
    const baselineY = PADDING.top + probH;
    const yesFill = areaPathUnderLine(yesPath, yesPoints, baselineY);
    const noFill = areaPathUnderLine(noPath, noPoints, baselineY);

    const yesSeriesValues = series.map((p) => p.yes);
    const credHistory = buildCredibilityHistory(market, yesSeriesValues);
    const influenceHistory = buildNarrativeInfluenceHistory(market, yesSeriesValues);
    const credPoints = credHistory.map((p, i) => ({ x: toX(i), y: toY(p) }));
    const influencePoints = influenceHistory.map((p, i) => ({ x: toX(i), y: toY(p) }));
    const credPath = smoothLinePath(credPoints);
    const influencePath = smoothLinePath(influencePoints);

    const mapIdx = (globalIndex: number) =>
      mapGlobalIndexToSlice(globalIndex, fullSeries, series);

    const laneByIndex = new Map<number, number>();
    const placedNarratives: PlacedNarrative[] = narrativeMarkers.map((m) => {
      const idx = mapIdx(m.historyIndex);
      const pt = yesPoints[idx] ?? yesPoints[0];
      const lane = laneByIndex.get(idx) ?? 0;
      laneByIndex.set(idx, lane + 1);
      return {
        ...m,
        x: pt?.x ?? PADDING.left,
        y: PADDING.top + 10 + lane * 20,
        lane,
      };
    });

    const agentLaneByIndex = new Map<number, number>();
    const placedAgents: PlacedAgent[] = agentMarkers.map((m) => {
      const idx = mapIdx(m.historyIndex);
      const lane = agentLaneByIndex.get(idx) ?? 0;
      agentLaneByIndex.set(idx, lane + 1);
      return {
        ...m,
        x: toX(idx),
        y: toY(m.confidence) - lane * 14,
      };
    });

    const maxVol = Math.max(...activitySeries.map((a) => a.volume), 1);
    const maxPart = Math.max(...activitySeries.map((a) => a.participation), 1);
    const activityBaseY = PADDING.top + probH + 4;
    const activityBars = activitySeries.map((a, i) => ({
      x: toX(i),
      volH: (a.volume / maxVol) * (activityH - 8),
      partH: (a.participation / maxPart) * (activityH - 8),
    }));

    return {
      yesPath,
      noPath,
      yesFill,
      noFill,
      credPath,
      influencePath,
      yesPoints,
      noPoints,
      placedNarratives,
      placedAgents,
      activityBars,
      activityBaseY,
      activityH,
      probH,
      mapIdx,
      toX,
      innerW,
    };
  }, [
    fullSeries,
    market,
    series,
    narrativeMarkers,
    agentMarkers,
    activitySeries,
    mode,
    showVolume,
    showParticipation,
  ]);

  const handlePointerMove = useCallback(
    (clientX: number) => {
      const el = chartAreaRef.current;
      if (!el || series.length === 0) return;
      const rect = el.getBoundingClientRect();
      setHoverIdx(indexFromPointerX(clientX, rect, series.length));
    },
    [series.length],
  );

  const handlePointerLeave = useCallback(() => {
    setHoverIdx(null);
  }, []);

  const selectedEvent =
    chart.placedNarratives.find((m) => m.id === selectedEventId) ?? null;
  const hoveredEvent =
    chart.placedNarratives.find((m) => m.id === hoveredEventId) ?? null;

  const hoverPoint = hoverIdx != null ? series[hoverIdx] : null;
  const hoverActivity = hoverIdx != null ? activitySeries[hoverIdx] : null;
  const hoverX = hoverIdx != null ? chart.yesPoints[hoverIdx]?.x : null;
  const hoverYesY = hoverIdx != null ? chart.yesPoints[hoverIdx]?.y : null;

  const gridLines = [0, 25, 50, 75, 100];
  const isMarket = mode === "market";
  const isNarrative = mode === "narrative";

  const uniqueAgents = useMemo(() => {
    const seen = new Set<string>();
    return agentMarkers.filter((m) => {
      if (seen.has(m.agentSlug)) return false;
      seen.add(m.agentSlug);
      return true;
    });
  }, [agentMarkers]);

  const endLabel = formatChartTimestamp(series[series.length - 1]?.t ?? Date.now(), timeRange);
  const startLabel = formatRangeAxisLabel(timeRange, series);

  return (
    <section className="rounded-xl border border-zinc-800/70 bg-zinc-950/90 overflow-hidden min-w-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div
        className={`border-b border-zinc-800/60 px-3 sm:px-4 ${
          compactToolbar ? "py-1.5 flex flex-col gap-1" : "py-3 flex flex-col gap-3"
        }`}
      >
        {compactToolbar ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ModeSwitch
                mode={mode}
                onChange={(next) => {
                  setMode(next);
                  setSelectedEventId(null);
                }}
              />
              <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Chart time range">
                {CHART_TIME_RANGES.map((range) => (
                  <ToggleChip
                    key={range}
                    active={timeRange === range}
                    onClick={() => {
                      setTimeRange(range);
                      setHoverIdx(null);
                    }}
                  >
                    {range}
                  </ToggleChip>
                ))}
              </div>
            </div>
            {isMarket && (
              <div
                className="flex flex-wrap items-center gap-1.5"
                role="group"
                aria-label="Market chart options"
              >
                <ToggleChip active={showVolume} onClick={() => setShowVolume((v) => !v)}>
                  Volume
                </ToggleChip>
                <ToggleChip
                  active={showParticipation}
                  onClick={() => setShowParticipation((p) => !p)}
                >
                  Participation
                </ToggleChip>
                <span className="text-[9px] text-zinc-600 ml-auto hidden sm:inline">
                  {yesProb}% YES · {noProb}% NO
                </span>
              </div>
            )}
            {isNarrative && (
              <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[9px] text-zinc-600">
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-0 border-t border-dashed border-zinc-500" />
                  Credibility
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-0 border-t border-dashed border-violet-400/80" />
                  Narrative influence
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400/80" />
                  Agent entry
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400/80" />
                  Event marker
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ModeSwitch
                mode={mode}
                onChange={(next) => {
                  setMode(next);
                  setSelectedEventId(null);
                }}
              />
              <p className="text-[10px] text-zinc-600 max-w-[220px] text-right leading-snug">
                {isMarket ? "What happened to this market?" : "Who moved the market?"}
              </p>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  {isMarket ? "YES / NO probability" : "Narrative timeline"}
                </h2>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="text-xl sm:text-2xl font-semibold tabular-nums text-emerald-400">
                    {yesProb}%
                    <span className="text-xs font-medium text-emerald-400/70 ml-1">YES</span>
                  </span>
                  <span className="text-xl sm:text-2xl font-semibold tabular-nums text-rose-400">
                    {noProb}%
                    <span className="text-xs font-medium text-rose-400/70 ml-1">NO</span>
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1" role="group" aria-label="Chart time range">
                {CHART_TIME_RANGES.map((range) => (
                  <ToggleChip
                    key={range}
                    active={timeRange === range}
                    onClick={() => {
                      setTimeRange(range);
                      setHoverIdx(null);
                    }}
                  >
                    {range}
                  </ToggleChip>
                ))}
              </div>
            </div>

            {isMarket && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Market chart options">
                <ToggleChip active={showVolume} onClick={() => setShowVolume((v) => !v)}>
                  Volume
                </ToggleChip>
                <ToggleChip
                  active={showParticipation}
                  onClick={() => setShowParticipation((p) => !p)}
                >
                  Participation
                </ToggleChip>
              </div>
            )}

            {isNarrative && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-zinc-600">
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-0 border-t border-dashed border-zinc-500" />
                  Credibility
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-0 border-t border-dashed border-violet-400/80" />
                  Narrative influence
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400/80" />
                  Agent entry
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400/80" />
                  Event marker
                </span>
              </div>
            )}
          </>
        )}
      </div>

      <div
        ref={chartAreaRef}
        className={`relative px-2 sm:px-3 select-none ${
          compactToolbar ? "py-0.5 sm:py-1" : "py-2 sm:py-3"
        }`}
        onMouseMove={(e) => handlePointerMove(e.clientX)}
        onMouseLeave={handlePointerLeave}
        onTouchMove={(e) => {
          const touch = e.touches[0];
          if (touch) handlePointerMove(touch.clientX);
        }}
        onTouchEnd={handlePointerLeave}
      >
        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className={
            compactToolbar
              ? "w-full h-[min(72vh,580px)] min-h-[280px] sm:min-h-[550px] sm:h-[580px] sm:max-h-[600px]"
              : "w-full h-[min(48vh,420px)] min-h-[260px] sm:min-h-[320px]"
          }
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={
            isMarket
              ? `Market probability chart, ${yesProb}% YES across ${series.length} data points`
              : `Narrative timeline chart for ${market.title}`
          }
        >
          <defs>
            <linearGradient id="market-yes-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={YES_FILL} />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
            <linearGradient id="market-no-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={NO_FILL} />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
            <clipPath id="chart-plot-clip">
              <rect
                x={PADDING.left}
                y={PADDING.top}
                width={CHART_W - PADDING.left - PADDING.right}
                height={CHART_H - PADDING.top - PADDING.bottom}
              />
            </clipPath>
          </defs>

          {gridLines.map((pct) => {
            const y = PADDING.top + chart.probH * (1 - pct / 100);
            return (
              <g key={pct}>
                <line
                  x1={PADDING.left}
                  y1={y}
                  x2={CHART_W - PADDING.right}
                  y2={y}
                  stroke="rgba(63,63,70,0.35)"
                  strokeDasharray={pct === 50 ? "0" : "3 5"}
                  strokeWidth={pct === 50 ? 1 : 0.75}
                />
                <text
                  x={PADDING.left - 8}
                  y={y + 3}
                  fill="rgba(113,113,122,0.8)"
                  fontSize="10"
                  textAnchor="end"
                >
                  {pct}%
                </text>
              </g>
            );
          })}

          <g clipPath="url(#chart-plot-clip)">
            {isNarrative && chart.yesFill && (
              <path d={chart.yesFill} fill="url(#market-yes-fill)" opacity={0.4} />
            )}

            {isMarket && (
              <>
                {chart.noFill && <path d={chart.noFill} fill="url(#market-no-fill)" />}
                {chart.yesFill && <path d={chart.yesFill} fill="url(#market-yes-fill)" />}
                <path
                  d={chart.noPath}
                  fill="none"
                  stroke={NO_COLOR}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={chart.yesPath}
                  fill="none"
                  stroke={YES_COLOR}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            )}

            {isNarrative && (
              <>
                <path
                  d={chart.yesPath}
                  fill="none"
                  stroke={YES_MUTED}
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={chart.credPath}
                  fill="none"
                  stroke={CRED_COLOR}
                  strokeWidth="1.5"
                  strokeDasharray="6 4"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={chart.influencePath}
                  fill="none"
                  stroke={INFLUENCE_COLOR}
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            )}

            {isMarket &&
              chart.activityH > 0 &&
              chart.activityBars.map((bar, i) => (
                <g key={`act-${i}`}>
                  {showVolume && (
                    <rect
                      x={bar.x - 2.5}
                      y={chart.activityBaseY + chart.activityH - bar.volH}
                      width={5}
                      height={bar.volH}
                      fill="rgba(113,113,122,0.4)"
                      rx={1}
                    />
                  )}
                  {showParticipation && (
                    <rect
                      x={bar.x - 2}
                      y={chart.activityBaseY + chart.activityH - bar.partH}
                      width={4}
                      height={bar.partH}
                      fill="rgba(52,211,153,0.35)"
                      rx={1}
                    />
                  )}
                </g>
              ))}

            {isNarrative &&
              chart.placedAgents.map((m) => {
                const isYes = m.side === "YES";
                const anchorY =
                  chart.yesPoints[chart.mapIdx(m.historyIndex)]?.y ?? m.y + 20;
                return (
                  <g key={m.id}>
                    <line
                      x1={m.x}
                      y1={m.y}
                      x2={m.x}
                      y2={anchorY}
                      stroke={isYes ? "rgba(52,211,153,0.28)" : "rgba(251,113,133,0.28)"}
                      strokeWidth="1"
                      strokeDasharray="2 3"
                    />
                    <circle
                      cx={m.x}
                      cy={m.y}
                      r={5}
                      fill={isYes ? YES_COLOR : NO_COLOR}
                      stroke="rgba(9,9,11,0.95)"
                      strokeWidth="1.5"
                    />
                  </g>
                );
              })}

            {isNarrative &&
              chart.placedNarratives.map((m) => {
                const style = NARRATIVE_KIND_STYLE[m.kind];
                const active = selectedEventId === m.id || hoveredEventId === m.id;
                const anchorY =
                  chart.yesPoints[
                    Math.min(chart.mapIdx(m.historyIndex), chart.yesPoints.length - 1)
                  ]?.y ?? PADDING.top + chart.probH;
                return (
                  <g key={m.id}>
                    <line
                      x1={m.x}
                      y1={m.y + 5}
                      x2={m.x}
                      y2={anchorY}
                      stroke="rgba(113,113,122,0.35)"
                      strokeWidth="1"
                    />
                    <circle
                      cx={m.x}
                      cy={m.y}
                      r={active ? 5.5 : 3.5}
                      fill={style.svgFill}
                      stroke={style.svgRing}
                      strokeWidth={active ? 2 : 1}
                    />
                  </g>
                );
              })}
          </g>

          {hoverIdx != null && hoverX != null && (
            <g pointerEvents="none">
              <line
                x1={hoverX}
                y1={PADDING.top}
                x2={hoverX}
                y2={PADDING.top + chart.probH + chart.activityH}
                stroke="rgba(161,161,170,0.55)"
                strokeWidth="1"
                strokeDasharray="4 3"
              />
              {hoverYesY != null && (
                <>
                  <line
                    x1={PADDING.left}
                    y1={hoverYesY}
                    x2={CHART_W - PADDING.right}
                    y2={hoverYesY}
                    stroke="rgba(161,161,170,0.25)"
                    strokeWidth="1"
                  />
                  <circle
                    cx={hoverX}
                    cy={hoverYesY}
                    r={5}
                    fill={YES_COLOR}
                    stroke="rgba(9,9,11,0.95)"
                    strokeWidth="2"
                  />
                </>
              )}
            </g>
          )}
        </svg>

        {hoverPoint && hoverActivity && hoverIdx != null && (
          <ChartHoverTooltip
            leftPct={((chart.yesPoints[hoverIdx]?.x ?? PADDING.left) / CHART_W) * 100}
            topPct={12}
            timestamp={formatChartTimestamp(hoverPoint.t, timeRange)}
            yes={hoverPoint.yes}
            no={hoverPoint.no}
            volume={formatVolume(hoverActivity.volume)}
            participation={hoverActivity.participation}
            leadingForecaster={leadingForecaster}
          />
        )}

        {isNarrative && (
          <div className="absolute inset-0 px-2 sm:px-3 py-2 sm:py-3 pointer-events-none">
            {chart.placedAgents.map((m) => {
              const leftPct = (m.x / CHART_W) * 100;
              const topPct = (m.y / CHART_H) * 100;
              const isYes = m.side === "YES";
              return (
                <div
                  key={`agent-${m.id}`}
                  className="absolute flex flex-col items-center pointer-events-auto"
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    transform: "translate(-50%, -100%)",
                  }}
                >
                  <Link
                    href={`/agents/${m.agentSlug}`}
                    className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 bg-zinc-950/90 shadow-sm transition hover:bg-zinc-900 ${
                      isYes ? "border-emerald-500/30" : "border-rose-500/30"
                    }`}
                  >
                    <Avatar name={m.agentName} size="xs" />
                    <span
                      className={`text-[9px] font-semibold whitespace-nowrap ${
                        isYes ? "text-emerald-300/90" : "text-rose-300/90"
                      }`}
                    >
                      {m.agentName}
                    </span>
                  </Link>
                </div>
              );
            })}

            {chart.placedNarratives.map((m) => {
              const leftPct = (m.x / CHART_W) * 100;
              const topPct = (m.y / CHART_H) * 100;
              const style = NARRATIVE_KIND_STYLE[m.kind];
              const active = selectedEventId === m.id;
              return (
                <div
                  key={m.id}
                  className="absolute pointer-events-auto"
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                  onMouseEnter={() => setHoveredEventId(m.id)}
                  onMouseLeave={() => setHoveredEventId(null)}
                >
                  <button
                    type="button"
                    className={`flex max-w-[148px] items-center gap-1 rounded scry-tap-target ${
                      active ? "scale-105" : ""
                    }`}
                    aria-label={m.headline}
                    aria-pressed={active}
                    onClick={() =>
                      setSelectedEventId((id) => (id === m.id ? null : m.id))
                    }
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ring-2 ${style.dot} ${style.ring}`}
                    />
                    <span className={`text-[9px] font-medium truncate ${style.label}`}>
                      {m.headline}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {isNarrative && hoveredEvent && (
          <EventHoverTooltip
            marker={hoveredEvent}
            leftPct={(hoveredEvent.x / CHART_W) * 100}
            topPct={(hoveredEvent.y / CHART_H) * 100}
          />
        )}

        {isNarrative && uniqueAgents.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1 mt-2">
            {uniqueAgents.slice(0, 6).map((a) => (
              <Link
                key={a.agentSlug}
                href={`/agents/${a.agentSlug}`}
                className="text-[9px] text-zinc-500 hover:text-zinc-300 border border-zinc-800/80 rounded-full px-2 py-0.5 transition"
              >
                {a.agentName}
              </Link>
            ))}
          </div>
        )}

        <div className="flex justify-between text-[10px] text-zinc-600 px-1 mt-1.5">
          <span className="tabular-nums">{startLabel}</span>
          <span className="tabular-nums text-right">
            {isMarket ? (
              <>Now · {yesProb}% YES · {endLabel}</>
            ) : (
              <>{market.agent_count} agents on thread</>
            )}
          </span>
        </div>

        {isNarrative && selectedEvent && (
          <NarrativeThesisPanel
            marker={selectedEvent}
            onClose={() => setSelectedEventId(null)}
          />
        )}
      </div>
    </section>
  );
}
