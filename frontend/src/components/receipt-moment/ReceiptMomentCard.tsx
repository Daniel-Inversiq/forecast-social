"use client";

import Link from "next/link";
import {
  Avatar,
  formatTimeAgo,
  MiniProbBar,
} from "@/components/feed/shared";
import { motionClass } from "@/components/feed/motion";
import { displayReceiptId } from "@/lib/receiptIds";
import {
  receiptConsensusLine,
  receiptHeadline,
  receiptSubline,
  receiptTimingLine,
} from "@/lib/receiptMomentCopy";
import { STRENGTH_STYLES } from "@/components/verified-calls/strengthStyles";
import type { EnrichedVerifiedCall } from "@/components/verified-calls/types";
import { ReceiptMomentActions } from "./ReceiptMomentActions";

export type ReceiptMomentVariant = "feed" | "detail" | "modal" | "compact";

function profileHref(call: EnrichedVerifiedCall): string {
  return call.subject_type === "user"
    ? `/u/${call.agent_slug}`
    : `/agents/${call.agent_slug}`;
}

function handleLabel(call: EnrichedVerifiedCall): string {
  return call.subject_type === "user" ? `@${call.agent_slug}` : call.agent_name;
}

export function ReceiptMomentCard({
  call,
  variant = "detail",
  index = 0,
  showActions = true,
  className,
}: {
  call: EnrichedVerifiedCall;
  variant?: ReceiptMomentVariant;
  index?: number;
  showActions?: boolean;
  className?: string;
}) {
  const style = STRENGTH_STYLES[call.receipt_strength];
  const scrId = call.receipt_id || displayReceiptId(call.id);
  const headline = receiptHeadline(call);
  const consensusLine = receiptConsensusLine(call);
  const isFeed = variant === "feed";
  const isCompact = variant === "compact";
  const isDetail = variant === "detail" || variant === "modal";

  const glow =
    call.receipt_strength === "legendary"
      ? "from-amber-950/35 via-zinc-950/95"
      : call.receipt_strength === "early"
        ? "from-emerald-950/25 via-zinc-950/95"
        : call.receipt_strength === "contested"
          ? "from-violet-950/22 via-zinc-950/95"
          : "from-zinc-900/50 via-zinc-950/95";

  return (
    <article
      id={`receipt-${call.id}`}
      data-receipt-id={call.id}
      className={[
        "receipt-moment-card relative overflow-hidden rounded-xl border",
        "bg-gradient-to-br to-zinc-950/98",
        glow,
        call.is_verified
          ? `border-amber-500/25 ring-1 ${style.glow}`
          : "border-zinc-800/85",
        isFeed ? "feed-hover-lift feed-card-glow" : "feed-hover-lift",
        !isCompact ? motionClass.cardEnterStagger(index) : "",
        isDetail ? "shadow-[0_24px_80px_-40px_rgba(245,158,11,0.25)]" : "",
        className ?? "",
      ].join(" ")}
    >
      {/* Archival watermark */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        aria-hidden
        style={{
          backgroundImage:
            "repeating-linear-gradient(-24deg, transparent, transparent 11px, rgba(245,158,11,0.15) 11px, rgba(245,158,11,0.15) 12px)",
        }}
      />
      <div
        className="pointer-events-none absolute right-3 top-3 sm:right-5 sm:top-5 w-[72px] sm:w-20 rotate-[-8deg] select-none text-center font-mono text-[7px] sm:text-[8px] leading-tight text-amber-200/30"
        aria-hidden
      >
        {`RECEIPT\n${scrId}\nLOCKED\n${call.days_early}d EDGE`}
      </div>

      {/* Header band */}
      <header className="relative border-b border-amber-500/15 bg-zinc-950/85 px-3 py-2.5 sm:px-5 sm:py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-950/50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-amber-200/95">
              <span className="h-1 w-1 rounded-full bg-amber-400/90" aria-hidden />
              {headline}
            </span>
            {call.is_verified && (
              <span className="hidden sm:inline text-[9px] uppercase tracking-wider text-amber-500/60">
                Receipt locked
              </span>
            )}
          </div>
          <span className="font-mono text-[9px] text-amber-500/65 tracking-wide shrink-0">
            {scrId}
          </span>
        </div>
        {!isCompact && (
          <p className="mt-1.5 text-[11px] text-zinc-400 leading-snug">{receiptSubline(call)}</p>
        )}
      </header>

      <div className={`relative ${isCompact ? "p-3" : "p-3 sm:p-5"}`}>
        {/* Subject row */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <Link
            href={profileHref(call)}
            className="flex min-w-0 items-center gap-2.5 rounded-lg -m-1 p-1 transition hover:bg-zinc-900/50"
          >
            <Avatar name={call.agent_name} color={call.avatar_color} size={isFeed ? "md" : "lg"} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{call.agent_name}</p>
              <p className="text-[10px] text-zinc-500">{handleLabel(call)}</p>
              <p className="text-[10px] text-zinc-600">
                Call made {formatTimeAgo(call.first_signal_at)}
              </p>
            </div>
          </Link>
          {call.is_verified && (
            <div className="shrink-0 text-right">
              <p className="text-base font-semibold tabular-nums text-amber-200/95">
                +{call.reputation_delta}
              </p>
              <p className="text-[9px] uppercase tracking-wider text-zinc-600">reputation</p>
            </div>
          )}
        </div>

        {/* Market + thesis */}
        <Link
          href={`/markets/${call.market_slug}`}
          className="mb-2 block text-[13px] sm:text-sm font-semibold leading-snug text-zinc-100 transition hover:text-amber-100/90"
        >
          {call.market_title}
        </Link>

        <p
          className={`mb-3 border-l-2 border-amber-500/30 pl-3 text-zinc-300 leading-relaxed ${
            isCompact ? "text-xs line-clamp-3" : "text-sm"
          }`}
        >
          {call.original_take}
        </p>

        {/* Prediction + outcome row */}
        <div className={`mb-3 grid gap-2 ${isCompact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/45 px-2.5 py-2">
            <p className="mb-0.5 text-[7px] uppercase tracking-wider text-zinc-600">Prediction</p>
            <p className="text-sm font-semibold text-violet-200 tabular-nums">{call.side}</p>
            <p className="text-[10px] text-zinc-500 tabular-nums">
              {Math.round(call.original_probability)}% at entry
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/45 px-2.5 py-2">
            <p className="mb-0.5 text-[7px] uppercase tracking-wider text-zinc-600">Outcome</p>
            <p className="text-sm font-semibold text-emerald-300/90 tabular-nums">{call.final_outcome}</p>
            <p className="text-[10px] text-zinc-500">Verified resolution</p>
          </div>
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/45 px-2.5 py-2">
            <p className="mb-0.5 text-[7px] uppercase tracking-wider text-zinc-600">Timing</p>
            <p className="text-sm font-semibold text-amber-200/90 tabular-nums">{call.days_early}d</p>
            <p className="text-[10px] text-zinc-500">{receiptTimingLine(call.days_early)}</p>
          </div>
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/45 px-2.5 py-2">
            <p className="mb-0.5 text-[7px] uppercase tracking-wider text-zinc-600">Entry consensus</p>
            <p className="text-sm font-semibold text-zinc-200 tabular-nums">
              {Math.round(call.consensus_at_time)}%
            </p>
            {consensusLine && (
              <p className="text-[9px] text-zinc-500 leading-tight mt-0.5">{consensusLine}</p>
            )}
          </div>
        </div>

        {!isCompact && (
          <div className="mb-3 rounded-lg border border-zinc-800/55 bg-zinc-950/65 px-3 py-2.5">
            <p className="mb-1.5 text-[8px] uppercase tracking-wider text-zinc-600">
              Consensus migration
            </p>
            <div className="mb-1 flex items-center justify-between text-[8px] text-zinc-600">
              <span>At entry</span>
              <span className="text-amber-400/70">Stamped before repricing</span>
              <span>Verified</span>
            </div>
            <MiniProbBar value={call.consensus_at_time} size="xs" animated={false} />
            <div className="my-1 h-px bg-gradient-to-r from-zinc-800 via-amber-500/25 to-amber-500/15" />
            <MiniProbBar value={call.final_consensus} size="xs" animated={false} />
          </div>
        )}

        {/* Footer stats */}
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-500">
          <span className={`rounded border px-1.5 py-0.5 ${style.badge}`}>
            {style.label}
          </span>
          {call.conviction_payout != null && call.conviction_payout > 0 && (
            <span className="text-zinc-400">
              Conviction resolved · ${Math.round(call.conviction_payout)}
            </span>
          )}
          {call.isolation_score >= 60 && (
            <span>Isolation {call.isolation_score}%</span>
          )}
          <span className="font-mono text-amber-500/50">{scrId}</span>
        </div>

        {showActions && (
          <ReceiptMomentActions call={call} compact={isFeed || isCompact} />
        )}
      </div>
    </article>
  );
}
