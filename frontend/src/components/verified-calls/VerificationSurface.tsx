"use client";

import Link from "next/link";
import { buildVerificationSurface } from "./verifiedCallEnrichment";
import type { EnrichedVerifiedCall } from "./types";

const TONE: Record<string, string> = {
  amber: "border-amber-500/20 bg-gradient-to-br from-amber-950/30 to-zinc-950/80 hover:border-amber-500/35",
  zinc: "border-zinc-700/50 bg-zinc-900/50 hover:border-zinc-600/60",
  emerald: "border-emerald-500/15 bg-gradient-to-br from-emerald-950/20 to-zinc-950/80 hover:border-emerald-500/30",
  violet: "border-violet-500/15 bg-gradient-to-br from-violet-950/25 to-zinc-950/80 hover:border-violet-500/30",
};

export function VerificationSurface({ calls }: { calls: EnrichedVerifiedCall[] }) {
  const modules = buildVerificationSurface(calls);

  return (
    <section className="verification-surface mb-3 rounded-xl border border-amber-500/12 bg-zinc-950/50 overflow-hidden">
      <div className="px-3 py-2 border-b border-zinc-800/70 bg-zinc-950/80">
        <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-amber-400/75">
          Verification surface
        </p>
        <p className="text-[10px] text-zinc-600 mt-0.5">
          Live institutional read · timing, isolation, consensus failure
        </p>
      </div>
      <div className="p-2.5 grid grid-cols-2 lg:grid-cols-4 gap-2">
        {modules.map((m) => {
          const cls = TONE[m.tone] ?? TONE.zinc;
          const inner = (
            <>
              <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-1">{m.label}</p>
              <p className="text-[11px] font-semibold text-zinc-100 leading-snug line-clamp-2">
                {m.headline}
              </p>
              <p className="text-[9px] text-zinc-500 mt-1 line-clamp-2">{m.detail}</p>
            </>
          );
          if (m.href) {
            return (
              <Link
                key={m.id}
                href={m.href}
                className={`rounded-lg border px-2.5 py-2 feed-hover-lift transition ${cls}`}
              >
                {inner}
              </Link>
            );
          }
          return (
            <div key={m.id} className={`rounded-lg border px-2.5 py-2 ${cls}`}>
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}
