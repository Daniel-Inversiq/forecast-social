"use client";

import Link from "next/link";
import { useState } from "react";
import {
  HeatPill,
  LiveDot,
  MiniSparkline,
  MomentumIndicator,
  MoveBadge,
  NarrativeStrengthBar,
  TactileButton,
  formatTimeAgo,
} from "@/components/feed/shared";
import { sparklinePoints } from "@/components/feed/motion";
import { RankCompactBadge } from "@/components/reputation/RankContextDisplay";
import { buildCredibilityFromAgent } from "@/lib/credibilityScore";
import { getRankContext } from "@/lib/rankContext";
import { titleToSlug } from "@/lib/slugs";
import { TYPE_STYLES } from "./narrativeEnrichment";
import type { EnrichedNarrative } from "./types";

function driverAgentRank(slug: string) {
  const credibility = buildCredibilityFromAgent({
    slug,
    reputation_score: 140 + (slug.length % 70) * 5,
  });
  return getRankContext({ slug, credibilityScore: credibility.score });
}

function AlignmentMeter({ alignment, fractured }: { alignment: number; fractured: boolean }) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[9px] text-zinc-600">
        <span>Network alignment</span>
        <span className={fractured ? "text-violet-300/90" : "text-sky-300/90"} tabular-nums>
          {alignment}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-800/90 overflow-hidden flex">
        <div
          className="h-full bg-gradient-to-r from-sky-600/80 to-violet-500/60 narrative-align-fill"
          style={{ width: `${alignment}%` }}
        />
        <div
          className="h-full bg-zinc-800/40 flex-1"
          style={{ opacity: fractured ? 0.6 : 0.3 }}
        />
      </div>
    </div>
  );
}

function VelocitySpark({ seed }: { seed: string }) {
  const pts = sparklinePoints(seed, 12);
  const w = 140;
  const h = 32;
  const step = w / (pts.length - 1);
  const d = pts
    .map((y, i) => {
      const x = i * step;
      const py = h - y * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="w-full max-w-[140px]" aria-hidden>
      <path
        d={d}
        fill="none"
        stroke="rgba(56,189,248,0.75)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClusterMap({ markets }: { markets: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {markets.slice(0, 4).map((m) => (
        <span
          key={m}
          className="text-[8px] px-1.5 py-0.5 rounded border border-zinc-800/80 bg-zinc-900/60 text-zinc-500 truncate max-w-[120px]"
        >
          {m}
        </span>
      ))}
      {markets.length > 4 && (
        <span className="text-[8px] text-zinc-600">+{markets.length - 4}</span>
      )}
    </div>
  );
}

export function NarrativeIntelligenceCard({
  narrative,
  index,
}: {
  narrative: EnrichedNarrative;
  index: number;
}) {
  const [followed, setFollowed] = useState(false);
  const style = TYPE_STYLES[narrative.type] ?? TYPE_STYLES.momentum_up;
  const dir =
    narrative.direction === "up"
      ? "up"
      : narrative.direction === "down"
        ? "down"
        : "flat";
  const stagger = `feed-stagger-${Math.min(index, 12)}`;

  return (
    <article
      className={`narrative-card feed-card-enter ${stagger} rounded-xl border border-zinc-800/80 bg-zinc-950/70 overflow-hidden feed-hover-lift relative ${style.glow}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-sky-600/5 via-transparent to-violet-600/8 pointer-events-none" />

      {/* TOP */}
      <div className="relative px-3 sm:px-4 pt-3 pb-2 border-b border-zinc-800/60">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {narrative.is_live && <LiveDot color="violet" />}
            <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${style.badge}`}>
              {style.label}
            </span>
            <HeatPill tone="sky">{narrative.category}</HeatPill>
            {narrative.is_breaking && (
              <HeatPill tone="amber" pulse>
                Breaking
              </HeatPill>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <MomentumIndicator direction={dir} label={narrative.momentum_label} />
            <MoveBadge delta={Math.round(narrative.change)} />
          </div>
        </div>

        <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight leading-snug">
          {narrative.title}
        </h2>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-zinc-500">
          <span>
            <span className="text-zinc-400 tabular-nums font-semibold">{narrative.strength.toFixed(0)}</span>{" "}
            narrative score
          </span>
          <span>
            <span className="text-sky-300/90 tabular-nums font-semibold">
              {narrative.velocity.toFixed(1)}
            </span>{" "}
            velocity
          </span>
          <span>{narrative.driver_agents.length} agents</span>
          <span>{narrative.cluster_markets.length} markets</span>
          <span className="text-zinc-600">{formatTimeAgo(narrative.created_at, true)}</span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {narrative.driver_agents.slice(0, 4).map((slug) => {
            const rank = driverAgentRank(slug);
            return (
              <Link
                key={slug}
                href={`/agents/${slug}`}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-zinc-900/80 text-zinc-400 hover:text-sky-200 border border-zinc-800/80 transition"
                onClick={(e) => e.stopPropagation()}
              >
                <span>@{slug}</span>
                <RankCompactBadge rank={rank} />
              </Link>
            );
          })}
        </div>
      </div>

      {/* CENTER */}
      <div className="relative px-3 sm:px-4 py-3 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <p className="text-[9px] uppercase tracking-wider text-zinc-600">What is changing</p>
            <p className="text-[11px] text-zinc-400 leading-relaxed">{narrative.whats_changing}</p>
          </div>
          <div className="space-y-1.5">
            <p className="text-[9px] uppercase tracking-wider text-zinc-600">Why it matters</p>
            <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-4">
              {narrative.why_matters}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/30 p-2.5 space-y-2">
          <p className="text-[9px] uppercase tracking-wider text-zinc-600">Network intelligence</p>
          <ul className="text-[10px] text-zinc-500 space-y-1">
            <li>
              <span className="text-zinc-600">Drivers:</span>{" "}
              {narrative.driver_agents.map((s) => `@${s}`).join(", ") || "cluster forming"}
            </li>
            <li>
              <span className="text-zinc-600">Markets reacting:</span>{" "}
              {narrative.cluster_markets.slice(0, 2).join(" · ") || "—"}
            </li>
            <li>
              <span className="text-zinc-600">Battles:</span>{" "}
              {narrative.linked_battles[0]?.label ?? "none linked"}
            </li>
            <li>
              <span className="text-zinc-600">Verified overlap:</span>{" "}
              {narrative.linked_verified[0]?.label ?? "scanning archive"}
            </li>
          </ul>
        </div>

        {/* VISUALIZATION */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <NarrativeStrengthBar
              strength={narrative.strength}
              accelerating={narrative.is_live}
              label="Conviction momentum"
            />
            <AlignmentMeter alignment={narrative.alignment} fractured={narrative.is_contrarian} />
          </div>
          <div className="flex flex-col justify-between gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/25 p-2">
            <div className="flex items-center justify-between">
              <p className="text-[9px] uppercase tracking-wider text-zinc-600">Narrative velocity</p>
              <MiniSparkline seed={narrative.id} tone="sky" width={56} height={14} />
            </div>
            <VelocitySpark seed={narrative.id + narrative.title} />
            <div>
              <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-1">Market overlap</p>
              <ClusterMap markets={narrative.cluster_markets} />
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM */}
      <div className="relative px-3 sm:px-4 py-2.5 border-t border-zinc-800/60 bg-zinc-900/20 flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex flex-wrap gap-1 min-w-0 flex-1">
          {narrative.cluster_markets.slice(0, 3).map((title) => (
            <Link
              key={title}
              href={`/markets/${titleToSlug(title)}`}
              className="text-[10px] px-2 py-0.5 rounded-md text-zinc-500 hover:text-sky-300 border border-zinc-800/80 truncate max-w-[160px] transition"
            >
              {title}
            </Link>
          ))}
          {narrative.linked_battles.map((b) => (
            <Link
              key={b.label}
              href={b.href}
              className="text-[10px] px-2 py-0.5 rounded-md text-violet-400/80 hover:text-violet-300 border border-violet-500/20 transition"
            >
              {b.label}
            </Link>
          ))}
          {narrative.linked_verified.map((v) => (
            <Link
              key={v.label}
              href={v.href}
              className="text-[10px] px-2 py-0.5 rounded-md text-emerald-400/80 hover:text-emerald-300 border border-emerald-500/20 transition"
            >
              {v.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 shrink-0">
          <TactileButton
            variant="emerald"
            onClick={() => {
              const m = narrative.market_slugs[0];
              if (m) window.location.href = `/markets/${m}`;
            }}
          >
            Take position
          </TactileButton>
          <TactileButton variant="violet" onClick={() => setFollowed((f) => !f)}>
            {followed ? "Following" : "Follow narrative"}
          </TactileButton>
          <Link
            href={narrative.market_slugs[0] ? `/markets/${narrative.market_slugs[0]}` : "/markets"}
            className="feed-chip-active text-[11px] px-2 py-1 rounded-md border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition inline-flex items-center"
          >
            View markets
          </Link>
        </div>
      </div>
    </article>
  );
}
