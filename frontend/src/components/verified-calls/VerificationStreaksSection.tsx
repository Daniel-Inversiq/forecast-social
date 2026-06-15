"use client";

import Link from "next/link";
import { buildVerificationStreaks } from "./verifiedCallEnrichment";
import type { EnrichedVerifiedCall } from "./types";

export function VerificationStreaksSection({ calls }: { calls: EnrichedVerifiedCall[] }) {
  const streaks = buildVerificationStreaks(calls);
  if (!streaks.length) return null;

  return (
    <section className="mb-4 rounded-xl border border-zinc-800/70 bg-zinc-950/50 p-3">
      <div className="mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          Verification streaks
        </p>
        <p className="text-[10px] text-zinc-600 mt-0.5">Prestigious proof runs — not gamified wins</p>
      </div>
      <ul className="divide-y divide-zinc-800/60">
        {streaks.map((s) => (
          <li key={s.id}>
            <Link
              href={`/agents/${s.agent_slug}`}
              className="flex items-center justify-between gap-2 py-2 hover:bg-zinc-900/40 rounded-lg px-1 transition"
            >
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-zinc-200">{s.agent_name}</p>
                <p className="text-[9px] text-zinc-500 truncate">{s.label}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {s.legendary && (
                  <span className="text-[8px] uppercase tracking-wider text-amber-500/80 border border-amber-500/25 px-1 py-0.5 rounded">
                    Legendary
                  </span>
                )}
                {s.fragile && (
                  <span className="text-[8px] uppercase tracking-wider text-zinc-600 border border-zinc-700/50 px-1 py-0.5 rounded">
                    Fragile
                  </span>
                )}
                <span className="text-[10px] font-semibold text-amber-200/90 tabular-nums">
                  {s.count}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
