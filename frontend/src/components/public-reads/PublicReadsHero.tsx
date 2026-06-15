"use client";



import Link from "next/link";

import { LiveDot, HeatPill } from "@/components/feed/shared";

import { DISTRIBUTION_TAGLINE } from "@/lib/trust";

import {

  consensusDelta,

  formatAuthorIdentityLine,

  formatOnRecordTimestamp,

  getConvictionLevel,

  pickFeedReads,

} from "./publicReadEnrichment";

import {
  PublicReadAuthorBlock,
  PublicReadPotentialImpact,
  publicReadAuthorHref,
} from "./PublicReadParts";

import type { PublicRead } from "./types";



function FeaturedReadHero({ read }: { read: PublicRead }) {

  const conviction = getConvictionLevel(read.probability);

  const delta = consensusDelta(read);

  const sideTone = read.side === "YES" ? "text-emerald-300" : "text-rose-300";



  return (

    <div className="rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-950/40 via-zinc-950/90 to-zinc-950/80 p-3.5 sm:p-4 relative overflow-hidden">

      <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 blur-3xl rounded-full pointer-events-none" />

      <div className="relative">

        <div className="flex flex-wrap items-center gap-2 mb-3">

          <LiveDot color="violet" />

          <HeatPill tone="violet" pulse>

            Live reputational event

          </HeatPill>

          <span className="text-[10px] text-zinc-500 ml-auto">{formatOnRecordTimestamp(read.createdAt)}</span>

        </div>



        <PublicReadAuthorBlock read={read} showHandle={false} />



        <p className="mt-3 text-sm font-medium text-zinc-200 line-clamp-2 leading-snug">{read.title}</p>

        <p className="text-[10px] text-zinc-600 mt-0.5">{read.marketOrNarrative}</p>



        <div className="mt-3 mb-3 max-w-xs">
          <PublicReadPotentialImpact read={read} compact />
        </div>

        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">

          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/50 px-2.5 py-2">

            <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5">Call</p>

            <p className={`text-lg font-bold tabular-nums ${sideTone}`}>

              {read.probability}% {read.side}

            </p>

            {conviction && (

              <p className={`text-[10px] font-medium mt-0.5 ${conviction.toneClass}`}>{conviction.label}</p>

            )}

          </div>

          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/50 px-2.5 py-2">

            <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5">Forecaster</p>

            <Link

              href={publicReadAuthorHref(read)}

              className="text-xs font-semibold text-zinc-100 hover:text-violet-200 truncate block"

            >

              {read.authorName}

            </Link>

            <p className="text-[9px] text-violet-300/80 mt-0.5 line-clamp-2">{formatAuthorIdentityLine(read)}</p>

          </div>

          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/50 px-2.5 py-2">

            <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5">Consensus</p>

            <p className="text-xs tabular-nums text-zinc-300">

              {read.consensusAtPost}% → {read.currentConsensus}%

            </p>

            {delta !== 0 && (

              <p

                className={`text-[10px] font-semibold mt-0.5 tabular-nums ${

                  delta > 0 ? "text-emerald-400" : "text-rose-400"

                }`}

              >

                {delta > 0 ? "+" : ""}

                {delta}pt since post

              </p>

            )}

          </div>

          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/50 px-2.5 py-2">

            <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5">At stake</p>

            <p className="text-xs text-zinc-300 tabular-nums">

              {read.backersCount} backers · {read.challengersCount} challengers

            </p>

            {read.credibilityAtStake != null && read.credibilityAtStake > 0 && (

              <p className="text-[10px] text-violet-400/85 mt-0.5 tabular-nums">

                {read.credibilityAtStake} cred on the line

              </p>

            )}

          </div>

        </div>



        <Link href="/reads" className="text-[10px] text-violet-400 mt-3 inline-block hover:text-violet-300 font-medium">

          View all reads →

        </Link>

      </div>

    </div>

  );

}



export function PublicReadsHero({

  reads,

  onCreateClick,

}: {

  reads: PublicRead[];

  onCreateClick: () => void;

}) {

  const featured = pickFeedReads(reads, 1)[0];

  const openCount = reads.filter((r) => r.status !== "resolved").length;

  const challenged = reads.filter((r) => r.status === "challenged").length;



  return (

    <section className="feed-top-signal mb-3 rounded-xl border border-violet-500/20 bg-zinc-950/60 overflow-hidden relative">

      <div className="absolute inset-0 bg-gradient-to-br from-violet-950/40 via-zinc-950/80 to-transparent pointer-events-none" />

      <div className="relative px-3 py-3 sm:px-4 sm:py-4">

        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">

          <div className="min-w-0 flex-1">

            <div className="flex flex-wrap items-center gap-2 mb-1.5">

              <LiveDot color="violet" />

              <HeatPill tone="violet" pulse>

                On record

              </HeatPill>

            </div>

            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-white">

              Public Reads

            </h1>

            <p className="text-[11px] sm:text-sm text-zinc-400 mt-1 max-w-xl">

              Forecasts on record before they become receipts.

            </p>

            <p className="text-[10px] text-violet-400/70 mt-2">{DISTRIBUTION_TAGLINE}</p>

          </div>

          <button

            type="button"

            onClick={onCreateClick}

            className="shrink-0 scry-tap-target text-[11px] px-3 py-2 rounded-lg border border-violet-500/40 bg-violet-600/20 text-violet-100 hover:bg-violet-600/35 font-semibold transition"

          >

            Make a Public Read

          </button>

        </div>



        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">

          {[

            { label: "Live reads", value: String(openCount) },

            { label: "Challenged", value: String(challenged) },

            { label: "Loop", value: "Read → Receipt" },

            { label: "Proof", value: "Resolved → SCR" },

          ].map((s) => (

            <div

              key={s.label}

              className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2.5 py-2"

            >

              <p className="text-[8px] uppercase tracking-wider text-zinc-600">{s.label}</p>

              <p className="text-xs font-semibold text-white tabular-nums">{s.value}</p>

            </div>

          ))}

        </div>



        {featured && <FeaturedReadHero read={featured} />}

      </div>

    </section>

  );

}

