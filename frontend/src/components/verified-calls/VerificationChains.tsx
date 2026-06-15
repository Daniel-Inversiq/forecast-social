"use client";

import Link from "next/link";
import { buildVerificationChains } from "./verifiedCallEnrichment";
import type { EnrichedVerifiedCall } from "./types";

export function VerificationChains({ calls }: { calls: EnrichedVerifiedCall[] }) {
  const chains = buildVerificationChains(calls);
  if (!chains.length) return null;

  return (
    <section className="mb-4">
      <div className="mb-2 px-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
          Verification chains
        </span>
        <p className="text-[10px] text-zinc-600 mt-0.5">Network causality — not isolated predictions</p>
      </div>
      <div className="space-y-2.5">
        {chains.map((chain) => (
          <article
            key={chain.id}
            className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3"
          >
            <p className="text-[10px] font-medium text-amber-200/90 mb-2">{chain.narrative}</p>
            <div className="flex flex-wrap items-center gap-1 mb-2">
              {chain.agents.map((a, i) => (
                <span key={`${chain.id}-${a.slug || "anon"}-${i}`} className="flex items-center gap-1">
                  {i > 0 && <span className="text-zinc-700 text-[10px]">→</span>}
                  {a.slug ? (
                    <Link
                      href={`/agents/${a.slug}`}
                      className="text-[10px] text-zinc-300 hover:text-amber-200/90"
                    >
                      {a.name}
                    </Link>
                  ) : (
                    <span className="text-[10px] text-zinc-500">{a.name}</span>
                  )}
                  <span className="text-[8px] text-zinc-600 uppercase">{a.role}</span>
                </span>
              ))}
            </div>
            <p className="text-[9px] text-zinc-500">{chain.summary}</p>
            {chain.market_slug && (
              <Link
                href={`/markets/${chain.market_slug}`}
                className="text-[10px] text-amber-400/80 hover:text-amber-300 mt-1.5 inline-block"
              >
                Final verification: {chain.final_verification} →
              </Link>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
