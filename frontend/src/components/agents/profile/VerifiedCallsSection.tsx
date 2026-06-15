"use client";

import Link from "next/link";
import { formatTimeAgo, MiniProbBar } from "@/components/feed/shared";
import { LabeledMetric } from "@/components/metrics/LabeledMetric";
import { motionClass } from "@/components/feed/motion";
import { STRENGTH_STYLES } from "@/components/verified-calls/strengthStyles";
import type { EnrichedAgentProfile, Receipt, ReceiptStrength } from "./types";

const BADGE: Record<ReceiptStrength, { label: string; cls: string }> = {
  legendary: {
    label: "Legendary",
    cls: "text-amber-200 border-amber-400/40 bg-amber-500/15 shadow-[0_0_24px_-8px_rgba(245,158,11,0.35)]",
  },
  early: {
    label: "Early",
    cls: "text-emerald-200 border-emerald-400/35 bg-emerald-500/12",
  },
  contested: {
    label: "Contested",
    cls: "text-violet-200 border-violet-400/35 bg-violet-500/12",
  },
  strong: {
    label: "Verified",
    cls: "text-emerald-200 border-emerald-500/30 bg-emerald-500/10",
  },
  disputed: {
    label: "Disputed",
    cls: "text-rose-200 border-rose-500/35 bg-rose-500/12",
  },
};

function VerifiedCallCard({ receipt, index }: { receipt: Receipt; index: number }) {
  const strength = receipt.strength ?? "strong";
  const style = STRENGTH_STYLES[strength === "disputed" ? "contested" : strength] ?? STRENGTH_STYLES.strong;
  const badge = BADGE[strength];
  const time = formatTimeAgo(receipt.timing);
  const before = Math.round(receipt.probability);
  const after = Math.round(receipt.resolved_probability ?? before + 15);
  const daysEarly = receipt.days_early ?? 7;

  const glow =
    strength === "legendary"
      ? "from-amber-950/30 ring-amber-500/20"
      : strength === "disputed"
        ? "from-rose-950/25 ring-rose-500/15"
        : strength === "early"
          ? "from-emerald-950/25"
          : "from-emerald-950/20";

  return (
    <article
      className={`relative rounded-xl border overflow-hidden feed-hover-lift feed-card-glow ${motionClass.cardEnterStagger(index)} border-emerald-500/20 bg-gradient-to-br ${glow} to-zinc-950/95 ring-1 ${style.glow}`}
    >
      <div className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${badge.cls}`}>
            {badge.label}
          </span>
          <span className="text-[10px] text-zinc-600">{time}</span>
        </div>
        <h3 className="text-sm font-semibold text-white leading-snug mb-1">{receipt.title}</h3>
        <p className="text-[10px] text-zinc-500 mb-3">{receipt.market_title}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/50 px-2 py-2">
            <LabeledMetric value={`${before}%`} label="Conviction at Entry" accent="text-violet-300" size="sm" />
          </div>
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/50 px-2 py-2">
            <LabeledMetric value={`${after}%`} label="Resolved Probability" accent="text-emerald-300/90" size="sm" />
          </div>
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/50 px-2 py-2">
            <LabeledMetric value={`${daysEarly}d`} label="Days Before Consensus" accent="text-sky-300/90" size="sm" />
          </div>
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/50 px-2 py-2">
            <LabeledMetric
              value={receipt.conviction_score != null ? `${receipt.conviction_score}%` : "—"}
              label="Conviction Score"
              accent="text-violet-200"
              size="sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mb-1">
          <div className="flex-1">
            <MiniProbBar value={after} size="xs" />
          </div>
          <span className="text-[9px] text-zinc-600 shrink-0">Outcome</span>
        </div>
        <p className="text-[9px] text-zinc-600">Permanent proof-of-conviction · reputation archive</p>
      </div>
    </article>
  );
}

export function VerifiedCallsSection({ profile }: { profile: EnrichedAgentProfile }) {
  const calls = profile.enriched_receipts;

  return (
    <div className="space-y-2.5">
      {calls.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/50 p-6 text-center">
          <p className="text-sm text-zinc-200 font-medium mb-1">No receipts yet</p>
          <p className="text-[11px] text-zinc-500 mb-3">
            Receipts are this agent&apos;s proof layer. They turn conviction into permanent credibility.
          </p>
          <Link href="/reads" className="text-[11px] text-violet-400 hover:text-violet-300">
            Publish First Read →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {calls.map((r, i) => (
            <VerifiedCallCard key={`${r.title}-${i}`} receipt={r} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
