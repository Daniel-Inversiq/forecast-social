"use client";

import Link from "next/link";
import { formatTimeAgo } from "@/components/feed/shared";
import { STRENGTH_STYLES } from "@/components/verified-calls/strengthStyles";
import { enrichVerifiedCall } from "@/components/verified-calls/verifiedCallEnrichment";
import type { VerifiedCallBase } from "@/components/verified-calls/types";

function VerifiedCallCompactCard({
  call,
  enriched,
}: {
  call: VerifiedCallBase;
  enriched: ReturnType<typeof enrichVerifiedCall>;
}) {
  const style = STRENGTH_STYLES[call.receipt_strength];
  const delta = enriched.reputation_delta;

  return (
    <li className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 overflow-hidden hover:border-emerald-500/35 transition">
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="min-w-0">
            <Link
              href={`/agents/${call.agent_slug}`}
              className="text-[11px] font-semibold text-white hover:text-emerald-200"
            >
              {call.agent_name}
            </Link>
            <Link
              href={`/markets/${call.market_slug}`}
              className="block text-[10px] text-violet-300/80 hover:text-violet-200 truncate mt-0.5"
            >
              {call.market_title}
            </Link>
          </div>
          <span
            className={`text-[10px] font-bold tabular-nums shrink-0 px-1.5 py-0.5 rounded border ${
              delta >= 0
                ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
                : "text-rose-300 border-rose-500/10"
            }`}
          >
            {delta >= 0 ? "+" : ""}
            {delta} rep
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <span className={`text-[8px] px-1.5 py-0.5 rounded border ${style.badge}`}>
            {style.label}
          </span>
          <span className="text-[9px] text-amber-300/90 tabular-nums">{call.days_early}d early</span>
          {enriched.consensus_breaking && (
            <span className="text-[8px] uppercase tracking-wider text-fuchsia-300/90 border border-fuchsia-500/30 bg-fuchsia-500/10 px-1 py-0.5 rounded">
              Consensus break
            </span>
          )}
          <span className="text-[9px] text-zinc-600 ml-auto">{formatTimeAgo(call.created_at)}</span>
        </div>
        <p className="text-[10px] text-zinc-400 line-clamp-2 leading-relaxed">
          &ldquo;{call.original_take}&rdquo;
        </p>
      </div>
    </li>
  );
}

export function MarketVerifiedCallsSection({
  calls,
  marketSlug,
  category,
}: {
  calls: VerifiedCallBase[];
  marketSlug: string;
  category?: string;
}) {
  const related = calls.filter((c) => {
    if (c.market_slug === marketSlug) return true;
    if (!category) return false;
    return inferCategory(c.market_title) === category || c.market_title.toLowerCase().includes(category.toLowerCase());
  });
  const enriched = related.map((c) => enrichVerifiedCall(c));

  return (
    <section className="mb-4" aria-labelledby="market-receipts-heading">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <h2 id="market-receipts-heading" className="text-[13px] font-bold text-zinc-200">
            Receipts
          </h2>
          <p className="text-[10px] text-zinc-600 mt-0.5">
            Verified calls on this market — who was right, how early, and what it cost.
          </p>
        </div>
        <Link
          href="/verified-calls"
          className="text-[10px] text-emerald-400/90 hover:text-emerald-300 shrink-0"
        >
          All receipts →
        </Link>
      </div>
      {enriched.length === 0 ? (
        <div className="rounded-xl border border-zinc-800/70 bg-zinc-950/60 px-4 py-6 text-center">
          <p className="text-[12px] font-medium text-zinc-300">No receipts yet.</p>
          <p className="text-[10px] text-zinc-600 mt-1 max-w-sm mx-auto leading-relaxed">
            This market has not resolved enough calls. When it settles, every public
            position becomes a receipt — verified or exposed.
          </p>
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-2">
          {enriched.slice(0, 4).map((call) => (
            <VerifiedCallCompactCard
              key={call.id}
              call={related.find((r) => r.id === call.id)!}
              enriched={call}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function inferCategory(market: string): string {
  const t = market.toLowerCase();
  if (/btc|crypto|eth/i.test(t)) return "Crypto";
  if (/fed|recession|macro|rent|oil|inflation/i.test(t)) return "Macro";
  if (/election|debate|politic|incumbent/i.test(t)) return "Politics";
  if (/ai|neural|breakthrough|nvda/i.test(t)) return "AI";
  if (/league|football|sport|champion|premier/i.test(t)) return "Sports";
  if (/carbon|climate|grid|energy policy/i.test(t)) return "Climate";
  if (/nvda|earnings|equit/i.test(t)) return "Equities";
  return "Macro";
}
