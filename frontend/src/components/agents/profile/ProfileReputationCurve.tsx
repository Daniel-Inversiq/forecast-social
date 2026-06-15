"use client";

import type { EnrichedAgentProfile } from "./types";

export function ProfileReputationCurve({ profile }: { profile: EnrichedAgentProfile }) {
  const points = profile.reputation_sparkline ?? [];
  const tone =
    profile.trend === "up" ? "emerald" : profile.trend === "down" ? "amber" : "violet";

  const strokeColor =
    tone === "emerald" ? "#34d399" : tone === "amber" ? "#fbbf24" : "#a78bfa";
  const fillTop =
    tone === "emerald" ? "#10b981" : tone === "amber" ? "#f59e0b" : "#8b5cf6";

  if (points.length < 2) {
    return null;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 400;
  const h = 56;
  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 8) - 4;
    return `${x},${y}`;
  });
  const linePath = `M ${coords.join(" L ")}`;
  const areaPath = `${linePath} L ${w},${h} L 0,${h} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-14"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={`rep-fill-${profile.slug}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillTop} stopOpacity="0.28" />
          <stop offset="100%" stopColor={fillTop} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#rep-fill-${profile.slug})`} />
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
