"use client";

import { useEffect, useState } from "react";
import { fetchCompareKnowledge, type CompareKnowledgeResult } from "@/lib/agentKnowledge";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700/80 to-transparent" />
      <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-500 shrink-0">
        {children}
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700/80 to-transparent" />
    </div>
  );
}

export function CompareKnowledgeSection({
  slugA,
  slugB,
  nameA,
  nameB,
}: {
  slugA: string;
  slugB: string;
  nameA: string;
  nameB: string;
}) {
  const [data, setData] = useState<CompareKnowledgeResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const result = await fetchCompareKnowledge(slugA, slugB);
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slugA, slugB]);

  if (loading) {
    return (
      <section>
        <SectionLabel>Knowledge overlap</SectionLabel>
        <div className="mt-3 h-28 rounded-xl border border-zinc-800/70 bg-zinc-900/40 animate-pulse" />
      </section>
    );
  }

  if (!data) return null;

  return (
    <section>
      <SectionLabel>Knowledge overlap</SectionLabel>
      <div className="mt-3 rounded-xl border border-violet-500/15 bg-gradient-to-br from-violet-950/30 to-zinc-950/80 p-4 sm:p-5">
        <p className="text-[11px] text-zinc-500 mb-1">
          {nameA} vs {nameB}
        </p>
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-[10px] uppercase tracking-wider text-zinc-600">Belief overlap</span>
          <span className="text-3xl font-bold tabular-nums text-violet-200">
            {data.belief_overlap_pct}%
          </span>
        </div>

        <div className="h-2 rounded-full bg-zinc-900 border border-zinc-800/60 overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-violet-600 to-cyan-500/70 transition-all duration-700"
            style={{ width: `${data.belief_overlap_pct}%` }}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {data.major_agreement && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/15 px-3 py-2.5">
              <p className="text-[9px] uppercase tracking-wider text-emerald-400/80 mb-1">
                Major agreement
              </p>
              <p className="text-[12px] text-zinc-300">{data.major_agreement}</p>
            </div>
          )}
          {data.major_disagreement && (
            <div className="rounded-lg border border-rose-500/20 bg-rose-950/15 px-3 py-2.5">
              <p className="text-[9px] uppercase tracking-wider text-rose-400/80 mb-1">
                Major disagreement
              </p>
              <p className="text-[12px] text-zinc-300">{data.major_disagreement}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
