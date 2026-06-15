"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FeedShell } from "@/components/feed/FeedShell";
import { HeatPill, LiveDot } from "@/components/feed/shared";
import { WalletIdentityChip, WalletLinkedConvictionBadge } from "@/components/wallet/WalletIdentityChip";
import { hasVerifiedWallet } from "@/lib/wallet/identity";
import { ConvictionCommandHero } from "@/components/positions/ConvictionCommandHero";
import { ConvictionMap } from "@/components/positions/ConvictionMap";
import { ConvictionStrip } from "@/components/positions/ConvictionStrip";
import { ConvictionTimeline } from "@/components/positions/ConvictionTimeline";
import { IdentityInsights } from "@/components/positions/IdentityInsights";
import { NarrativeExposurePanel } from "@/components/positions/NarrativeExposurePanel";
import {
  buildCommandCenter,
  buildConvictionSignals,
  buildIdentityInsights,
  buildNarrativeExposure,
  buildNetworkLayer,
  buildPressureFeed,
  enrichActive,
  enrichResolved,
  enrichTimelineEntries,
  groupActivePositionsByHorizon,
} from "@/components/positions/positionEnrichment";
import { PositionHorizonSections } from "@/components/positions/PositionHorizonSections";
import { MobileIntelRail } from "@/components/layout/MobileIntelRail";
import { PositionsSidebar } from "@/components/positions/PositionsSidebar";
import { PositionsLedgerEmptyState } from "@/components/positions/PositionsLedgerEmptyState";
import { ReceiptCard } from "@/components/positions/ReceiptCard";
import { ReceiptEmptyState } from "@/components/positions/ReceiptEmptyState";
import { RightIfRightPanel } from "@/components/positions/RightIfRightPanel";
import type { PositionsPayload } from "@/components/positions/types";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { apiFetch } from "@/lib/api";
import {
  EMPTY_MY_POSITIONS,
  fetchMyPositions,
  hasMyPositions,
} from "@/lib/myPositions";

type ConvictionBalanceMini = {
  available_balance: number;
  locked_balance: number;
  remaining_exposure: number;
  currency: string;
};

export default function PositionsPage() {
  const { user, loading: authLoading } = useRequireAuth("/me/positions");
  const [data, setData] = useState<PositionsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRefreshError, setShowRefreshError] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [convictionBalance, setConvictionBalance] = useState<ConvictionBalanceMini | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;

    async function load() {
      setLoading(true);
      setShowRefreshError(false);
      const result = await fetchMyPositions();
      setData(result.data);
      setShowRefreshError(result.showRefreshError);
      setLoading(false);
    }

    load();
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    async function loadConvictionBalance() {
      try {
        const res = await apiFetch("/me/conviction-balance");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as ConvictionBalanceMini;
        if (!cancelled) setConvictionBalance(data);
      } catch {
        /* ignore */
      }
    }
    loadConvictionBalance();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  useEffect(() => {
    const id = setInterval(() => setPulse((p) => p + 1), 6000);
    return () => clearInterval(id);
  }, []);

  const payload = data ?? EMPTY_MY_POSITIONS;
  const ledgerEmpty = !hasMyPositions(payload);
  const active = useMemo(
    () => payload.active_positions.map(enrichActive),
    [payload.active_positions],
  );
  const activeByHorizon = useMemo(() => groupActivePositionsByHorizon(active), [active]);
  const resolved = useMemo(
    () => payload.resolved_positions.map(enrichResolved),
    [payload.resolved_positions],
  );
  const timeline = useMemo(() => enrichTimelineEntries(payload), [payload]);
  const commandCenter = useMemo(
    () => buildCommandCenter(payload.stats, active, resolved, pulse),
    [payload.stats, active, resolved, pulse],
  );
  const signals = useMemo(() => buildConvictionSignals(active), [active]);
  const narrativeExposure = useMemo(
    () => buildNarrativeExposure(active, resolved),
    [active, resolved],
  );
  const pressureFeed = useMemo(() => buildPressureFeed(active), [active]);
  const networkAgents = useMemo(() => buildNetworkLayer(active), [active]);
  const insights = useMemo(() => {
    const base = buildIdentityInsights(active, resolved);
    if (user && hasVerifiedWallet(user)) {
      return [
        {
          id: "wallet-conviction",
          label: "Wallet-linked conviction",
          value: user.ens_name
            ? `${user.ens_name} · verified on ${user.wallet_chain_label ?? "chain"}`
            : `Verified wallet on ${user.wallet_chain_label ?? "Base"}`,
          tone: "violet" as const,
        },
        ...base,
      ];
    }
    return base;
  }, [active, resolved, user]);

  const showContent = !authLoading && user;

  return (
    <FeedShell activeNav="Positions" hideCategoryNav>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <LiveDot color="violet" />
          <p className="text-[11px] text-zinc-500 truncate">
            Conviction ledger · forecasting identity · reputation exposure map
          </p>
          <HeatPill tone="emerald" pulse>
            Live
          </HeatPill>
        </div>
      </div>

      {authLoading && (
        <p className="text-zinc-500 text-[11px] animate-pulse py-6">Loading conviction ledger…</p>
      )}

      {showContent && (
        <>
          {user && hasVerifiedWallet(user) && (
            <div className="mb-3 flex flex-wrap items-center gap-2 px-0.5">
              <WalletIdentityChip identity={user} />
              <WalletLinkedConvictionBadge />
            </div>
          )}
          {showRefreshError && !loading && (
            <p className="text-[10px] text-zinc-500 mb-3" role="status">
              Could not refresh your ledger right now. Reconnect and reload to see live positions.
            </p>
          )}

          {loading ? (
            <p className="text-zinc-500 text-[11px] animate-pulse py-6">Mapping conviction exposure…</p>
          ) : ledgerEmpty ? (
            <PositionsLedgerEmptyState />
          ) : (
            <>
              {convictionBalance && (
                <section className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 mb-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h2 className="text-[11px] font-semibold text-violet-200">Conviction Capital</h2>
                    <Link
                      href="/me/conviction"
                      className="text-[10px] text-violet-200 border border-violet-500/35 rounded-full px-2 py-0.5 bg-violet-500/10"
                    >
                      Manage Conviction Capital →
                    </Link>
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    Available {convictionBalance.available_balance.toFixed(2)} {convictionBalance.currency} · Locked
                    exposure {convictionBalance.locked_balance.toFixed(2)} {convictionBalance.currency} · Remaining
                    cap {convictionBalance.remaining_exposure.toFixed(2)} {convictionBalance.currency}
                  </p>
                </section>
              )}
              <ConvictionCommandHero center={commandCenter} />
              <ConvictionMap signals={signals} />
              <ConvictionStrip positions={active} />

              <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px] lg:gap-4 xl:gap-5">
                <div className="min-w-0 space-y-4">
                  <NarrativeExposurePanel
                    rows={narrativeExposure.rows}
                    identityLine={narrativeExposure.identity_line}
                  />
                  <IdentityInsights insights={insights} />

                  <section>
                    <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
                      <div className="flex items-center gap-2">
                        <HeatPill tone="violet" pulse>
                          Active
                        </HeatPill>
                        <h2 className="text-[11px] font-semibold text-zinc-300">Open convictions</h2>
                      </div>
                      <span className="text-[10px] text-zinc-600">{active.length} on record</span>
                    </div>
                    {active.length === 0 ? (
                      <p className="text-[10px] text-zinc-600 px-0.5">
                        No open convictions — resolved calls remain in the archive below.
                      </p>
                    ) : (
                      <PositionHorizonSections groups={activeByHorizon} />
                    )}
                  </section>

                  <RightIfRightPanel positions={active} />

                  <section>
                    <div className="flex items-center gap-2 mb-2 px-0.5">
                      <HeatPill tone="emerald">Archive</HeatPill>
                      <h2 className="text-[11px] font-semibold text-zinc-300">
                        Resolved archive
                      </h2>
                      <span className="text-[10px] text-zinc-600 ml-auto">forecasting receipts</span>
                    </div>
                    {resolved.length === 0 ? (
                      <ReceiptEmptyState />
                    ) : (
                      <div className="space-y-2">
                        {resolved.map((p, i) => (
                          <ReceiptCard key={p.id} position={p} index={i} />
                        ))}
                      </div>
                    )}
                  </section>

                  <ConvictionTimeline timeline={timeline} />

                  <div className="lg:hidden">
                    <MobileIntelRail
                      title="Strategic exposure"
                      subtitle="Pressure feed, network agents, ledger stats"
                      priority="high"
                    >
                      <PositionsSidebar
                        stats={payload.stats}
                        active={active}
                        resolved={resolved}
                        pressureFeed={pressureFeed}
                        networkAgents={networkAgents}
                      />
                    </MobileIntelRail>
                  </div>
                </div>

                <div className="hidden lg:block">
                  <PositionsSidebar
                    stats={payload.stats}
                    active={active}
                    resolved={resolved}
                    pressureFeed={pressureFeed}
                    networkAgents={networkAgents}
                  />
                </div>
              </div>
            </>
          )}
        </>
      )}
    </FeedShell>
  );
}
