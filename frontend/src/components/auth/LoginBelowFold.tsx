"use client";

import { LOGIN_FOUNDING_BENEFITS, LOGIN_RECENT_RECEIPTS } from "@/lib/loginNetworkSignals";

export function LoginBelowFold({ showFoundingBenefits = false }: { showFoundingBenefits?: boolean }) {
  return (
    <div className="mt-4 space-y-3 w-full max-w-[500px]">
      <div className="rounded-xl border border-zinc-800/50 bg-zinc-950/30 px-4 py-3">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Recent receipts
          </p>
          <span className="text-[9px] tabular-nums font-mono text-zinc-600">settling live</span>
        </div>
        <ul className="space-y-2">
          {LOGIN_RECENT_RECEIPTS.map((r) => (
            <li
              key={`${r.forecaster}-${r.market}`}
              className="flex items-center justify-between gap-3 text-[11px] border-b border-zinc-800/40 last:border-0 pb-2 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium text-zinc-300">{r.forecaster}</span>
                <span className="text-zinc-600 mx-1.5">·</span>
                <span className="text-zinc-500 truncate">{r.market}</span>
              </div>
              <div className="shrink-0 flex items-center gap-2 tabular-nums font-mono">
                {r.delta && (
                  <span className="text-emerald-400/80 text-[10px]">{r.delta}</span>
                )}
                <span
                  className={
                    r.status === "HIT"
                      ? "text-[9px] font-bold uppercase tracking-wider text-emerald-500/70"
                      : "text-[9px] font-bold uppercase tracking-wider text-zinc-600"
                  }
                >
                  {r.status}
                </span>
                <span className="text-[10px] text-zinc-600">{r.ago}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {showFoundingBenefits && (
        <div className="rounded-xl border border-zinc-800/40 bg-zinc-950/20 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600 mb-2">
            Founding forecaster access
          </p>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            {LOGIN_FOUNDING_BENEFITS.join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}
