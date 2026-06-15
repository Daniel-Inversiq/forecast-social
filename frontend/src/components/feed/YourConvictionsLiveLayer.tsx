"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { enrichActive } from "@/components/positions/positionEnrichment";
import type { ActivePosition, PositionsPayload } from "@/components/positions/types";
import { LiveDot } from "@/components/feed/shared";
import { useAuth } from "@/context/AuthProvider";
import { apiFetch } from "@/lib/api";
import {
  buildConvictionLiveRows,
  DEMO_CONVICTION_ROWS,
  nextResolutionLabel,
  useDemoConvictions,
  type ConvictionLiveRow,
} from "@/lib/convictionsLive";

const LOAD_TIMEOUT_MS = 8_000;

function ConvictionListRow({ row }: { row: ConvictionLiveRow }) {
  return (
    <Link
      href={row.href}
      className="flex items-baseline justify-between gap-2 py-1 rounded-md hover:bg-violet-500/5 transition -mx-0.5 px-0.5"
    >
      <span className="text-[11px] font-medium text-zinc-100 truncate min-w-0">{row.marketTitle}</span>
      <span className="text-[10px] text-zinc-400 tabular-nums shrink-0 whitespace-nowrap">
        {row.pnlLabel} · {row.resolveLabel}
      </span>
    </Link>
  );
}

function SingleConvictionBody({ row }: { row: ConvictionLiveRow }) {
  return (
    <div className="space-y-1">
      <Link href={row.href} className="block group">
        <h3 className="text-[13px] sm:text-sm font-semibold text-white leading-snug group-hover:text-violet-50 transition">
          {row.marketTitle}
        </h3>
      </Link>
      {row.backedAgent && (
        <p className="text-[10px] text-zinc-400">
          You backed:{" "}
          <span className="text-violet-200/90 font-medium">{row.backedAgent}</span>
        </p>
      )}
      <p className="text-[10px] text-zinc-500 tabular-nums">
        Current consensus:{" "}
        <span className="text-zinc-300">{row.consensusPct}%</span>
      </p>
      <p className="text-[11px] font-medium text-violet-200/95 tabular-nums">
        {row.pnlLabel} · <span className="text-zinc-400 font-normal capitalize">{row.resolveLabel}</span>
      </p>
    </div>
  );
}

export function YourConvictionsLiveLayer() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ConvictionLiveRow[]>([]);

  useEffect(() => {
    if (!user) {
      setRows([]);
      return;
    }

    let cancelled = false;
    let timedOut = false;

    async function load() {
      setLoading(true);
      try {
        const res = await apiFetch("/me/positions");
        if (cancelled || timedOut) return;
        if (!res.ok) {
          if (useDemoConvictions()) setRows(DEMO_CONVICTION_ROWS);
          return;
        }
        const data = (await res.json()) as PositionsPayload;
        const active = (data.active_positions ?? []).map((p: ActivePosition) => enrichActive(p));
        const built = buildConvictionLiveRows(active);
        if (built.length > 0) {
          setRows(built);
        } else if (useDemoConvictions()) {
          setRows(DEMO_CONVICTION_ROWS);
        } else {
          setRows([]);
        }
      } catch {
        if (!cancelled && useDemoConvictions()) setRows(DEMO_CONVICTION_ROWS);
      } finally {
        if (!cancelled && !timedOut) setLoading(false);
      }
    }

    const timeoutId = setTimeout(() => {
      timedOut = true;
      setLoading(false);
    }, LOAD_TIMEOUT_MS);

    void load();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [user]);

  const displayRows = rows;
  const isSingle = displayRows.length === 1;
  const nextResolve = useMemo(() => nextResolutionLabel(displayRows), [displayRows]);

  if (!user || loading || displayRows.length === 0) {
    return null;
  }

  const primary = displayRows[0]!;
  const ctaHref = isSingle ? primary.href : "/me/positions";
  const ctaLabel = isSingle ? "Open Position →" : "View All →";

  return (
    <section className="convictions-live-layer rounded-lg border border-violet-500/30 bg-gradient-to-br from-violet-950/35 via-zinc-950/98 to-zinc-950/98 overflow-hidden feed-fade-in shadow-md shadow-violet-950/20">
      <div className="relative px-3 py-2.5 sm:px-3.5 sm:py-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-[11px] sm:text-xs font-semibold text-violet-100/95 tracking-tight">
              Your Convictions
            </h2>
            <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-300/90">
              <LiveDot color="violet" />
              Live
            </span>
          </div>
        </div>

        {isSingle ? (
          <SingleConvictionBody row={primary} />
        ) : (
          <div className="space-y-0.5">
            <p className="text-[10px] text-violet-300/80 font-medium mb-1.5">
              {displayRows.length} open convictions
            </p>
            <div className="space-y-0">
              {displayRows.slice(0, 4).map((row) => (
                <ConvictionListRow key={row.positionId} row={row} />
              ))}
            </div>
            {nextResolve && (
              <p className="text-[10px] text-zinc-500 mt-2 pt-2 border-t border-violet-500/12">
                Next resolution:{" "}
                <span className="text-zinc-300 tabular-nums">{nextResolve}</span>
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end mt-2 pt-2 border-t border-violet-500/12">
          <Link
            href={ctaHref}
            className="text-[9px] font-medium text-violet-300/95 hover:text-violet-200 transition"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
