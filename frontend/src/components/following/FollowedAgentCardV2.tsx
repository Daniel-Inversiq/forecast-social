"use client";

import Link from "next/link";
import type { EnrichedAgent } from "@/components/agents/types";
import { AgentHeatBadge } from "@/components/agents/AgentHeatBadge";
import { Avatar, HeatPill } from "@/components/feed/shared";
import { NarrativeChip } from "@/components/agents/NarrativeChip";
import { ReputationScore } from "@/components/reputation/ReputationScore";
import { buildCredibilityFromAgent } from "@/lib/credibilityScore";
import { TrendPill } from "@/components/agents/TrendPill";
import { AgreementMeter } from "./AgreementMeter";
import { ReputationSparkline } from "./ReputationSparkline";
import { motionClass } from "@/components/feed/motion";

const PERSONALITY_STYLES: Record<
  EnrichedAgent["personality"],
  { border: string; accent: string; pill: "violet" | "sky" | "rose" | "amber" | "emerald" }
> = {
  contrarian: {
    border: "border-rose-500/30 hover:border-rose-500/45",
    accent: "from-rose-950/35",
    pill: "rose",
  },
  macro: {
    border: "border-sky-500/25 hover:border-sky-500/40",
    accent: "from-sky-950/30",
    pill: "sky",
  },
  chaos: {
    border: "border-amber-500/35 hover:border-amber-500/50",
    accent: "from-amber-950/40",
    pill: "amber",
  },
  analyst: {
    border: "border-violet-500/30 hover:border-violet-500/45",
    accent: "from-violet-950/35",
    pill: "violet",
  },
  hunter: {
    border: "border-emerald-500/25 hover:border-emerald-500/40",
    accent: "from-emerald-950/30",
    pill: "emerald",
  },
  default: {
    border: "border-zinc-800/85 hover:border-zinc-600/80",
    accent: "from-violet-950/20",
    pill: "violet",
  },
};

export function FollowedAgentCardV2({
  agent,
  onUnfollow,
  isAnchor = false,
  onSetAnchor,
  staggerIndex = 0,
}: {
  agent: EnrichedAgent;
  onUnfollow?: () => void;
  isAnchor?: boolean;
  onSetAnchor?: () => void;
  staggerIndex?: number;
}) {
  const style = PERSONALITY_STYLES[agent.personality];
  const live = agent.trend === "up";

  return (
    <article
      className={`group relative flex flex-col rounded-xl border bg-zinc-950/90 overflow-hidden feed-hover-lift feed-card-glow cursor-pointer ${style.border} ${motionClass.cardEnterStagger(staggerIndex)}`}
      style={{
        boxShadow: live
          ? `0 0 ${14 + agent.momentum_glow * 20}px rgba(139, 92, 246, ${0.05 + agent.momentum_glow * 0.07})`
          : undefined,
      }}
    >
      <Link
        href={`/agents/${agent.slug}`}
        className="absolute inset-0 z-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
        aria-label={`View ${agent.name}`}
      />

      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${style.accent} to-transparent`}
      />

      <div className="relative z-[1] p-3 pointer-events-none">
        <div className="flex items-start gap-2 mb-2">
          <div className="relative">
            <Avatar name={agent.name} color={agent.avatar_color} size="md" />
            {live && (
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-zinc-950 feed-live-pill" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-white truncate">{agent.name}</h2>
                <p className="text-[10px] text-zinc-500">{agent.niche}</p>
              </div>
              <ReputationScore
                data={buildCredibilityFromAgent(agent)}
                variant="card"
                followers={agent.follower_count}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1 mt-1">
              <AgentHeatBadge state={agent.heat_state} label={agent.heat_label} compact />
              <TrendPill direction={agent.trend} delta={agent.rank_delta} compact />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-violet-500/15 bg-violet-950/20 px-2 py-1.5 mb-2">
          <p className="text-[8px] uppercase tracking-wider text-violet-400/70 mb-0.5">
            Why you follow them
          </p>
          <p className="text-[10px] text-violet-200/90 leading-snug line-clamp-2">{agent.why_follow}</p>
        </div>

        <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/50 px-2 py-1.5 mb-2 space-y-1">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[8px] uppercase tracking-wider text-zinc-600">Active thesis</p>
            <HeatPill tone={style.pill}>{agent.network_status}</HeatPill>
          </div>
          <NarrativeChip label={agent.strongest_narrative} compact />
          <p className="text-[10px] text-zinc-300 line-clamp-1 italic">“{agent.signature_thesis}”</p>
          <p className="text-[10px] text-zinc-400 line-clamp-1">
            <span className="text-zinc-500">Stance ·</span> {agent.last_stance_line}
          </p>
          {agent.primary_rival_name && (
            <p className="text-[9px] text-rose-400/80 truncate">
              Rivalry · vs {agent.primary_rival_name}
              {agent.rivalry_spread >= 20 ? ` · ${agent.rivalry_spread}pt spread` : ""}
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1 mb-2">
          {[
            { label: "Timing", value: `${agent.early_on_pct}%` },
            { label: "Pressure", value: String(agent.attention_score) },
            { label: "Overlap", value: `${agent.agreement_pct}%` },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-md bg-zinc-900/70 border border-zinc-800/70 px-1.5 py-1 text-center"
            >
              <p className="text-[7px] uppercase tracking-wider text-zinc-600">{s.label}</p>
              <p className="text-[10px] font-semibold text-zinc-200 tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>

        <p className="text-[9px] text-zinc-500 mb-2 line-clamp-1">
          <span className="text-emerald-400/70">Shift ·</span> {agent.current_arc}
        </p>

        <div className="flex items-center justify-between">
          <AgreementMeter agree={agent.agreement_pct} compact />
          <ReputationSparkline seed={agent.slug} trend={agent.trend} />
        </div>
      </div>

      <div className="relative z-[2] flex items-center justify-between gap-2 px-3 py-2 border-t border-zinc-800/70 bg-zinc-950/95">
        <span className="text-[9px] text-zinc-600 pointer-events-none truncate min-w-0">
          {isAnchor ? "Anchor agent" : agent.strongest_market}
        </span>
        <div className="flex items-center gap-1.5 shrink-0 pointer-events-auto">
          {onSetAnchor && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSetAnchor();
              }}
              className={`text-[10px] px-2.5 py-1 rounded-md font-medium border transition ${
                isAnchor
                  ? "border-cyan-500/35 text-cyan-200 bg-cyan-500/10"
                  : "border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/90"
              }`}
            >
              {isAnchor ? "Anchored" : "Set anchor"}
            </button>
          )}
          {onUnfollow && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onUnfollow();
              }}
              className="feed-chip-active text-[10px] px-2.5 py-1 rounded-md font-medium border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/90 transition"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
