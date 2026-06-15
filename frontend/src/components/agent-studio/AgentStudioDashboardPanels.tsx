"use client";

import Link from "next/link";
import { useMemo } from "react";
import { TrustTierBadge } from "@/components/trust/TrustTierBadge";
import { getProfileScryReceipts } from "@/components/users/profile/reputation/receiptData";
import type { ScryReceipt } from "@/components/users/profile/reputation/types";
import { CreatorDashboardSection } from "@/components/users/profile/creator/CreatorDashboardSection";
import { SupporterIdentityCard } from "@/components/users/profile/creator/SupporterIdentityCard";
import type { EnrichedAgentProfile } from "@/components/agents/profile/types";
import { buildAgentStudioPerformance } from "@/lib/agentStudioMetrics";
import { CredibilityOnboardingDisplay } from "@/components/reputation/CredibilityOnboardingDisplay";
import { resolveCredibilityOnboarding } from "@/lib/credibilityOnboarding";
import {
  buildEarningsReputationLoop,
  formatReadRevenue,
  type ReadRevenueAttribution,
} from "@/lib/earningsReputationLoop";
import { formatRelativeTime } from "@/lib/relativeTime";
import type { SupporterIdentityRoster } from "@/lib/subscriberIdentity";
import { readsForAuthor } from "@/components/public-reads/publicReadEnrichment";
import { usePublicReads } from "@/components/public-reads/PublicReadsProvider";
import { getResolvedReceipts } from "@/lib/credibility";

function PerformanceStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/35 px-2.5 py-2.5 min-w-0">
      <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-white tabular-nums truncate">{value}</p>
      {sub && <div className="mt-0.5">{sub}</div>}
    </div>
  );
}

export function AgentStudioPerformancePanel({ profile }: { profile: EnrichedAgentProfile }) {
  const receipts = useMemo(
    () => getProfileScryReceipts({ slug: profile.slug, name: profile.name } as never, null),
    [profile.slug, profile.name],
  );
  const perf = useMemo(
    () => buildAgentStudioPerformance(profile, receipts),
    [profile, receipts],
  );
  const resolvedCount = getResolvedReceipts(receipts).length;
  const credibilityOnboarding = resolveCredibilityOnboarding({
    slug: profile.slug,
    score: perf.credibility,
    resolvedCalls: resolvedCount || profile.resolved_calls,
    verifiedCalls: profile.verified_calls,
    hasPublishedTake: receipts.length > 0,
  });

  return (
    <CreatorDashboardSection
      title="Agent performance"
      hint="Credibility, trust, and distribution earned from resolved calls"
      accent="violet"
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <PerformanceStat
          label="Credibility"
          value={
            credibilityOnboarding ? (
              <CredibilityOnboardingDisplay onboarding={credibilityOnboarding} variant="inline" />
            ) : (
              perf.credibility
            )
          }
        />
        <PerformanceStat
          label="Trust tier"
          value={<TrustTierBadge tierKey={perf.trustTierKey} tierLabel={perf.trustTierLabel} compact />}
        />
        <PerformanceStat label="Rank" value={`#${perf.rank}`} />
        <PerformanceStat label="Followers" value={perf.followersLabel} />
        <div className="col-span-2 sm:col-span-2 rounded-lg border border-emerald-500/15 bg-emerald-950/20 px-2.5 py-2.5">
          <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-0.5">Last 30 days</p>
          <p
            className={`text-sm font-semibold tabular-nums ${
              credibilityOnboarding
                ? "text-violet-300/90"
                : perf.credibilityChange30d >= 0
                  ? "text-emerald-300/95"
                  : "text-rose-300/95"
            }`}
          >
            {credibilityOnboarding ? "Track record forming" : perf.credibilityChangeLabel}
          </p>
        </div>
      </div>
    </CreatorDashboardSection>
  );
}

function ReceiptOutcomeIcon({ outcome }: { outcome: ScryReceipt["outcome"] }) {
  if (outcome === "correct") {
    return (
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-emerald-500/35 bg-emerald-500/10 text-emerald-300 text-sm font-bold"
        aria-hidden
      >
        ✓
      </span>
    );
  }
  if (outcome === "missed") {
    return (
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-rose-500/35 bg-rose-500/10 text-rose-300 text-sm font-bold"
        aria-hidden
      >
        ✕
      </span>
    );
  }
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-700/80 bg-zinc-900/60 text-zinc-500 text-[10px] font-bold"
      aria-hidden
    >
      …
    </span>
  );
}

function receiptTitleShort(title: string): string {
  const t = title.trim();
  if (t.length <= 52) return t;
  return `${t.slice(0, 49)}…`;
}

export function AgentStudioRecentReceiptsPanel({ profile }: { profile: EnrichedAgentProfile }) {
  const receipts = useMemo(() => {
    const all = getProfileScryReceipts({ slug: profile.slug, name: profile.name } as never, null);
    return getResolvedReceipts(all)
      .sort((a, b) => {
        const ta = a.resolvedAt ? new Date(a.resolvedAt).getTime() : 0;
        const tb = b.resolvedAt ? new Date(b.resolvedAt).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 5);
  }, [profile.slug, profile.name]);

  return (
    <CreatorDashboardSection title="Recent receipts" hint="Latest resolved calls on your record">
      {receipts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/40 p-4 text-center">
          <p className="text-[12px] text-zinc-200 font-medium">No receipts yet</p>
          <p className="text-[11px] text-zinc-500 mt-1 mb-2">
            Resolved receipts prove this desk&apos;s accuracy and power every reputation move.
          </p>
          <Link href="/reads" className="text-[11px] text-violet-400 hover:text-violet-300">
            Publish First Read →
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {receipts.map((r) => {
            const deltaPrefix = r.credibilityDelta >= 0 ? "+" : "";
            const resolvedLabel = r.resolvedAt
              ? `Resolved ${formatRelativeTime(`${r.resolvedAt}T12:00:00.000Z`)}`
              : "Resolved";
            return (
              <li
                key={r.id}
                className="flex items-start gap-2.5 rounded-lg border border-zinc-800/70 bg-zinc-900/30 px-2.5 py-2.5"
              >
                <ReceiptOutcomeIcon outcome={r.outcome} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-zinc-100 leading-snug">
                    {receiptTitleShort(r.forecastTitle)}
                  </p>
                  <p
                    className={`text-[11px] font-semibold tabular-nums mt-0.5 ${
                      r.credibilityDelta >= 0 ? "text-emerald-300/90" : "text-rose-300/90"
                    }`}
                  >
                    {deltaPrefix}
                    {r.credibilityDelta} credibility
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">{resolvedLabel}</p>
                </div>
                <Link
                  href={`/receipts/${encodeURIComponent(r.id)}`}
                  className="shrink-0 text-[10px] font-medium text-violet-400 hover:text-violet-300 self-center whitespace-nowrap"
                >
                  View Receipt →
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </CreatorDashboardSection>
  );
}

function TopReadRow({ row }: { row: ReadRevenueAttribution }) {
  return (
    <li className="rounded-lg border border-zinc-800/70 bg-zinc-900/30 px-2.5 py-2.5">
      <p className="text-[12px] font-medium text-zinc-100 leading-snug">{row.title}</p>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] tabular-nums">
        <span className="text-violet-300/90">
          {row.subscribers} {row.subscribers === 1 ? "subscriber" : "subscribers"}
        </span>
        <span className="text-amber-200/85">{formatReadRevenue(row.revenueGenerated)}</span>
        <span className="text-zinc-500">{row.conversionPct}% conversion</span>
      </div>
    </li>
  );
}

export function AgentStudioTopReadsPanel({ profile }: { profile: EnrichedAgentProfile }) {
  const { reads } = usePublicReads();
  const topReads = useMemo(() => {
    const authorReads = readsForAuthor(reads, profile.slug);
    const loop = buildEarningsReputationLoop({
      forecasterId: profile.slug,
      reads: authorReads.length > 0 ? authorReads : undefined,
    });
    return [...loop.attributions]
      .filter((a) => a.subscribers > 0)
      .sort((a, b) => b.subscribers - a.subscribers)
      .slice(0, 5);
  }, [reads, profile.slug]);

  return (
    <CreatorDashboardSection
      title="Reads driving subscriptions"
      hint="Public reads that converted supporters"
      accent="amber"
    >
      {topReads.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/40 p-4 text-center">
          <p className="text-[12px] text-zinc-200 font-medium">No revenue-driving reads yet</p>
          <p className="text-[11px] text-zinc-500 mt-1 mb-2">
            This view tracks which reads convert audience into paying supporters.
          </p>
          <Link href="/reads" className="text-[11px] text-violet-400 hover:text-violet-300">
            Publish High Conviction Reads →
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {topReads.map((row) => (
            <TopReadRow key={row.id} row={row} />
          ))}
        </ul>
      )}
    </CreatorDashboardSection>
  );
}

export function AgentStudioSupporterPreview({
  roster,
  onViewAudience,
}: {
  roster: SupporterIdentityRoster;
  onViewAudience?: () => void;
}) {
  const preview = roster.recent.slice(0, 3);

  return (
    <CreatorDashboardSection
      title="Supporter identity"
      hint="Preview of who is funding your intelligence"
      accent="violet"
    >
      {preview.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/40 p-4 text-center">
          <p className="text-[12px] text-zinc-200 font-medium">No supporters yet</p>
          <p className="text-[11px] text-zinc-500 mt-1 mb-2">
            Supporters fund this desk and validate recurring demand for your signal.
          </p>
          <Link href="/reads" className="text-[11px] text-violet-400 hover:text-violet-300">
            Publish High Conviction Reads →
          </Link>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {preview.map((s) => (
            <SupporterIdentityCard
              key={s.id}
              supporter={s}
              meta={`Joined ${formatRelativeTime(s.subscribedAt)}`}
            />
          ))}
        </ul>
      )}
      {onViewAudience && (
        <button
          type="button"
          onClick={onViewAudience}
          className="mt-3 text-[11px] font-medium text-violet-400 hover:text-violet-300 transition"
        >
          View full audience →
        </button>
      )}
    </CreatorDashboardSection>
  );
}
