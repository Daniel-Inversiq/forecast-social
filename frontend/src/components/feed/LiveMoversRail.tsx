"use client";



import Link from "next/link";

import { useEffect, useState } from "react";

import { API_BASE } from "@/lib/api";

import { titleToSlug } from "@/lib/slugs";

import { FALLBACK_TRENDING, type TrendingData } from "@/components/TrendingPanel";
import type { FeedIntelligenceModules } from "./feedEnrichment";

import {

  HeatPill,

  MiniSparkline,

  MomentumIndicator,

  MoveBadge,

  NarrativeStrengthBar,

  PanelShell,

  RankMotion,

} from "./shared";

import { momentumFromSeed } from "./motion";



const TRENDING_URL = `${API_BASE}/trending`;



type MoverId = "credibility_shift" | "rep_mover" | "contrarian" | "verified" | "cred_move";



function MoverCell({

  id,

  label,

  children,

  accent,

  expanded,

  onToggle,

  expandContent,

  personalization,

}: {

  id: MoverId;

  label: string;

  children: React.ReactNode;

  accent?: string;

  expanded: MoverId | null;

  onToggle: (id: MoverId) => void;

  expandContent?: React.ReactNode;

  personalization?: string;

}) {

  const isOpen = expanded === id;

  return (

    <button

      type="button"

      onClick={() => onToggle(id)}

      className={`min-w-[140px] sm:min-w-0 flex-1 text-left p-2.5 rounded-lg border transition-all duration-300 feed-hover-lift ${

        isOpen

          ? "border-violet-500/30 bg-zinc-900/80 shadow-md shadow-violet-950/15"

          : "border-zinc-800/70 bg-gradient-to-br hover:border-zinc-700/80"

      } ${accent ?? "from-zinc-900/50"} to-transparent`}

    >

      {personalization && (

        <p className="text-[8px] text-violet-400/70 mb-0.5 truncate">{personalization}</p>

      )}

      <p className="text-[9px] font-medium scry-text-tertiary mb-1.5">{label}</p>

      {children}

      {expandContent && (

        <div

          className={`mt-2 pt-2 border-t border-zinc-800/60 space-y-1.5 overflow-hidden transition-all duration-400 ${

            isOpen ? "max-h-32 opacity-100" : "max-h-0 opacity-0"

          }`}

        >

          {expandContent}

        </div>

      )}

    </button>

  );

}



export function LiveMoversRail({
  intelligenceModules,
}: {
  intelligenceModules?: FeedIntelligenceModules | null;
}) {

  const [data, setData] = useState<TrendingData | null>(null);

  const [loading, setLoading] = useState(true);

  const [expanded, setExpanded] = useState<MoverId | null>(null);



  useEffect(() => {

    async function load() {

      try {

        const res = await fetch(TRENDING_URL);

        if (!res.ok) throw new Error("trending failed");

        setData((await res.json()) as TrendingData);

      } catch {

        setData(FALLBACK_TRENDING);

      } finally {

        setLoading(false);

      }

    }

    load();

  }, []);



  const t = data ?? FALLBACK_TRENDING;
  const intel = intelligenceModules;
  const shiftUp = t.biggest_shift.direction === "up";
  const narrative0 = t.trending_narratives[0] ?? "Conviction in motion";
  const narrativeStrength = 55 + (narrative0.length % 35);

  const toggle = (id: MoverId) => setExpanded((prev) => (prev === id ? null : id));



  return (

    <PanelShell

      title="Live movers"

      subtitle="Reputation movers · verified proof · credibility shifts · consensus breaks"

      badge={<HeatPill tone="violet" pulse>Now</HeatPill>}

      className="!mb-0"

      headerClass="!py-2"

    >

      <div className="p-2 sm:p-2.5">

        {loading ? (

          <div className="h-14 flex items-center justify-center">

            <p className="text-[11px] text-zinc-600 animate-pulse">Scanning movers…</p>

          </div>

        ) : (

          <div className="flex gap-2 overflow-x-auto feed-scroll-x scrollbar-none sm:overflow-visible sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 touch-pan-x">

            <MoverCell
              id="credibility_shift"
              label="Credibility shift"
              accent="from-violet-950/40"
              expanded={expanded}
              onToggle={toggle}
              personalization={intel?.highest_credibility_shift?.credibility_label ?? "Reputation-weighted"}
              expandContent={
                <>
                  <p className="text-[10px] text-zinc-500 line-clamp-3">
                    {intel?.highest_credibility_shift?.summary ?? t.biggest_shift.summary}
                  </p>
                  <Link
                    href={
                      intel?.highest_credibility_shift?.href ??
                      `/markets/${titleToSlug(t.biggest_shift.market_title)}`
                    }
                    className="text-[10px] text-violet-400 hover:text-violet-300"
                  >
                    Follow narrative →
                  </Link>
                </>
              }
            >
              <p className="text-[12px] font-semibold scry-text-primary truncate">
                {intel?.highest_credibility_shift?.title ?? t.biggest_shift.market_title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <MoveBadge
                  delta={
                    intel?.highest_credibility_shift?.delta ??
                    (shiftUp ? t.biggest_shift.delta : -t.biggest_shift.delta)
                  }
                />
                <MiniSparkline seed={intel?.highest_credibility_shift?.title ?? t.biggest_shift.market_title} />
              </div>
            </MoverCell>

            <MoverCell
              id="rep_mover"
              label="Reputation mover"
              accent="from-emerald-950/25"
              expanded={expanded}
              onToggle={toggle}
              personalization={intel?.top_reputation_mover?.tier_label ?? "Strongest reputation mover"}
              expandContent={
                <>
                  <p className="text-[10px] text-zinc-500 line-clamp-2">
                    {intel?.top_reputation_mover?.summary ?? "Calibration and timing driving rank velocity."}
                  </p>
                  <Link
                    href={intel?.top_reputation_mover?.href ?? (t.fastest_rising_agent ? `/agents/${t.fastest_rising_agent.slug}` : "/leaderboards")}
                    className="text-[10px] text-emerald-400"
                  >
                    Profile →
                  </Link>
                </>
              }
            >
              <p className="text-[12px] font-semibold scry-text-primary truncate">
                {intel?.top_reputation_mover?.title ?? t.fastest_rising_agent?.name ?? "—"}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <RankMotion delta={intel?.top_reputation_mover?.reputation_delta ?? t.fastest_rising_agent?.rank_delta ?? 4} />
                <MomentumIndicator direction="up" />
              </div>
            </MoverCell>

            <MoverCell
              id="contrarian"
              label="Contrarian win"
              accent="from-fuchsia-950/30"
              expanded={expanded}
              onToggle={toggle}
              personalization="High-rep dissent"
              expandContent={
                <>
                  <p className="text-[10px] text-zinc-500 line-clamp-3">
                    {intel?.strongest_contrarian?.summary ?? narrative0}
                  </p>
                  <Link
                    href={intel?.strongest_contrarian?.href ?? `/markets/${titleToSlug(t.most_contested.title)}`}
                    className="text-[10px] text-fuchsia-400 hover:text-fuchsia-300"
                  >
                    View signal →
                  </Link>
                </>
              }
            >
              <p className="text-[12px] font-semibold scry-text-primary truncate">
                {intel?.strongest_contrarian?.title ?? t.most_contested.title}
              </p>
              <p className="text-[10px] text-fuchsia-300/80 mt-0.5 line-clamp-1">
                {intel?.strongest_contrarian?.agent_name ?? "Elite dissenters"} · contrarian-led
              </p>
            </MoverCell>

            <MoverCell
              id="verified"
              label="Verified proof"
              accent="from-emerald-950/35"
              expanded={expanded}
              onToggle={toggle}
              personalization={intel?.verified_proof?.reputation_impact ?? "Proof before consensus"}
              expandContent={
                <>
                  <p className="text-[10px] text-zinc-500 line-clamp-3">
                    {intel?.verified_proof?.summary ?? "Archived call before median repriced."}
                  </p>
                  <Link
                    href={intel?.verified_proof?.href ?? "/verified-calls"}
                    className="text-[10px] text-emerald-400"
                  >
                    View proof →
                  </Link>
                </>
              }
            >
              <p className="text-[12px] font-semibold scry-text-primary truncate">
                {intel?.verified_proof?.title ?? "Verified call surfaced"}
              </p>
              <p className="text-[10px] text-emerald-300/80 mt-0.5">
                {intel?.verified_proof?.agent_name ?? "Network"} ·{" "}
                {intel?.verified_proof?.verified_calls_count ?? "—"} verified
              </p>
            </MoverCell>

            <MoverCell
              id="cred_move"
              label="Consensus break"
              accent="from-sky-950/30"
              expanded={expanded}
              onToggle={toggle}
              personalization={
                intel?.credibility_market_move?.movement_type
                  ? `${intel.credibility_market_move.movement_type.replace("_", " ")}`
                  : "YES/NO rep split"
              }
              expandContent={
                <>
                  <p className="text-[10px] text-zinc-500 line-clamp-3">
                    {intel?.credibility_market_move?.summary ?? t.biggest_shift.summary}
                  </p>
                  <Link
                    href={
                      intel?.credibility_market_move?.href ??
                      `/markets/${titleToSlug(t.biggest_shift.market_title)}`
                    }
                    className="text-[10px] text-sky-400 hover:text-sky-300"
                  >
                    View narrative →
                  </Link>
                </>
              }
            >
              <p className="text-[12px] font-semibold scry-text-primary truncate">
                {intel?.credibility_market_move?.title ?? t.biggest_shift.market_title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {intel?.credibility_market_move?.probability != null && (
                  <span className="text-[10px] text-sky-300/90 tabular-nums">
                    {Math.round(intel.credibility_market_move.probability)}% YES
                  </span>
                )}
                {intel?.credibility_market_move?.reputation_yes_share != null && (
                  <span className="text-[10px] text-zinc-500">
                    {intel.credibility_market_move.reputation_yes_share}% rep on YES
                  </span>
                )}
                {!intel?.credibility_market_move && (
                  <NarrativeStrengthBar strength={narrativeStrength} accelerating label="Credibility" />
                )}
              </div>
            </MoverCell>

          </div>

        )}

      </div>

    </PanelShell>

  );

}


