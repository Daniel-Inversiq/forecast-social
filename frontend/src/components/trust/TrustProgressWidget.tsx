"use client";

import Link from "next/link";
import { TrustTierBadge } from "@/components/trust/TrustTierBadge";
import { TrustDistributionTagline } from "@/components/trust/TrustDistributionTagline";
import type { TrustProgressData } from "@/lib/trustProgress";
import { TRUST_PROGRESS_LADDER } from "@/lib/trustProgress";
import type { TrustTierKey } from "@/lib/trust";

function RequirementBar({ req }: { req: TrustProgressData["requirements"][0] }) {
  const pct = req.invertProgress
    ? req.met
      ? 100
      : Math.max(0, 100 - Math.round((req.current / Math.max(req.required + 1, 1)) * 100))
    : Math.min(100, Math.round((req.current / Math.max(req.required, 1)) * 100));

  const displayCurrent = req.id === "abuseFlags" ? req.current : req.current;
  const displayRequired =
    req.id === "abuseFlags" ? `${req.required} max` : String(req.required);

  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1 gap-2">
        <span className={req.met ? "text-emerald-400/90" : "text-zinc-500"}>{req.label}</span>
        <span
          className={`tabular-nums shrink-0 ${req.met ? "text-emerald-300/90 font-medium" : "text-zinc-300"}`}
        >
          {displayCurrent} / {displayRequired}
          {req.suffix ?? ""}
        </span>
      </div>
      <div className="h-2 bg-zinc-900/80 rounded-full overflow-hidden border border-zinc-800/60">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            req.met
              ? "bg-gradient-to-r from-emerald-600/90 to-cyan-500/70"
              : "bg-gradient-to-r from-violet-600/90 via-violet-500/80 to-cyan-500/60"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function TierLadder({
  currentTier,
  identityVerified,
}: {
  currentTier: TrustTierKey;
  identityVerified: boolean;
}) {
  const performance = TRUST_PROGRESS_LADDER.filter((t) => t.key !== "verified");
  const currentIdx = performance.findIndex((t) => t.key === currentTier);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {performance.map((tier, i) => {
        const isCurrent = tier.key === currentTier;
        const passed = currentIdx >= 0 && i < currentIdx;
        return (
          <span key={tier.key} className="flex items-center gap-1">
            {i > 0 && (
              <span className="text-[8px] text-zinc-700" aria-hidden>
                →
              </span>
            )}
            <span
              className={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border transition ${
                isCurrent
                  ? "border-violet-400/50 bg-violet-500/20 text-violet-100 font-bold shadow-[0_0_12px_rgba(139,92,246,0.25)]"
                  : passed
                    ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-400/75"
                    : "border-zinc-800/90 text-zinc-600 bg-zinc-950/40"
              }`}
            >
              {tier.label}
            </span>
          </span>
        );
      })}
      <span className="ml-1.5 pl-2 border-l border-zinc-800/80 flex items-center">
        <span
          className={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${
            identityVerified
              ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200 font-semibold"
              : "border-zinc-800/80 text-zinc-600 border-dashed"
          }`}
          title="Identity verification — separate from forecasting performance"
        >
          Verified
        </span>
      </span>
    </div>
  );
}

export function TrustProgressWidget({
  data,
  compact = false,
  showBenchmarkLink = true,
  className = "",
}: {
  data: TrustProgressData;
  compact?: boolean;
  showBenchmarkLink?: boolean;
  className?: string;
}) {
  const progressTitle = data.nextLabel
    ? `Progress to ${data.nextLabel}`
    : "Trust standing";

  return (
    <section
      className={`trust-progress-widget relative rounded-xl border border-violet-500/20 bg-zinc-950/70 overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-violet-950/35 via-zinc-950/20 to-cyan-950/15 pointer-events-none" />
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />

      <div className="relative px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white tracking-tight">{progressTitle}</h3>
            <TrustDistributionTagline className="mt-0.5" compact />
          </div>
          {showBenchmarkLink && !compact && (
            <Link
              href="/benchmark"
              className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-violet-300/90 hover:text-violet-200 border border-violet-500/25 bg-violet-500/10 px-2.5 py-1 rounded-full transition"
            >
              Benchmark →
            </Link>
          )}
        </div>

        <p className="text-[12px] text-cyan-100/85 leading-relaxed mb-3 border-l-2 border-cyan-500/30 pl-2.5">
          {data.summary}
        </p>

        <TierLadder currentTier={data.currentTier} identityVerified={data.identityVerified} />

        <div className="grid grid-cols-2 gap-3 mt-4 mb-3">
          <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2.5 py-2">
            <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-0.5">Current tier</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-base font-semibold text-white">{data.currentLabel}</span>
              <TrustTierBadge
                tierKey={data.currentTier}
                tierLabel={data.currentLabel}
                identityVerified={data.identityVerified}
                compact
              />
            </div>
          </div>
          <div className="rounded-lg border border-violet-500/15 bg-violet-950/25 px-2.5 py-2">
            <p className="text-[9px] uppercase tracking-wider text-violet-400/60 mb-0.5">Next tier</p>
            <p className="text-base font-semibold text-violet-100">
              {data.nextLabel ?? "Elite · maintained"}
            </p>
          </div>
        </div>

        {data.isObserver ? (
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-3 py-3 mb-3">
            <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
              Publish a conviction on a live market. When it resolves on record, you leave Observer and
              enter Emerging — your first step toward Trusted distribution.
            </p>
            <Link
              href="/"
              className="inline-flex items-center text-[11px] font-semibold text-cyan-200 border border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-1.5 rounded-lg transition"
            >
              Make first forecast →
            </Link>
          </div>
        ) : (
          data.nextLabel &&
          data.requirements.length > 0 && (
            <div className="mb-3">
              <p className="text-[9px] uppercase tracking-[0.16em] text-zinc-600 mb-2">Requirements</p>
              <div className="space-y-2.5">
                {data.requirements.map((req) => (
                  <RequirementBar key={req.id} req={req} />
                ))}
              </div>
            </div>
          )
        )}

        {data.unlocks.length > 0 && data.nextLabel && !compact && (
          <div className="rounded-lg border border-violet-500/15 bg-violet-950/20 px-2.5 py-2.5 mb-3">
            <p className="text-[9px] uppercase tracking-wider text-violet-400/70 mb-1.5">
              {data.nextLabel} unlocks
            </p>
            <ul className="space-y-1">
              {data.unlocks.map((u) => (
                <li key={u} className="text-[10px] text-zinc-400 flex gap-1.5">
                  <span className="text-violet-400 shrink-0">▸</span>
                  {u}
                </li>
              ))}
            </ul>
            <p className="text-[9px] text-zinc-600 mt-2 italic">{data.distributionTagline}</p>
          </div>
        )}

        {!compact && (
          <p className="text-[10px] text-zinc-500 leading-relaxed border-t border-zinc-800/50 pt-2.5">
            <span className="text-zinc-400">{data.pathHint}</span>
          </p>
        )}
      </div>
    </section>
  );
}
