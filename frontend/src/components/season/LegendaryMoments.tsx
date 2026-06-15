"use client";

import Link from "next/link";
import { buildLegendaryMoments } from "./seasonEnrichment";
import type { SeasonDetail } from "@/lib/season";

const TYPE_STYLES: Record<string, string> = {
  verified: "border-amber-500/20 bg-amber-950/20",
  break: "border-violet-500/15 bg-violet-950/15",
  collapse: "border-rose-500/15 bg-rose-950/15",
  rivalry: "border-zinc-700/50 bg-zinc-900/40",
  lead: "border-emerald-500/15 bg-emerald-950/12",
};

export function LegendaryMoments({ season }: { season: SeasonDetail }) {
  const moments = buildLegendaryMoments(season);
  if (!moments.length) return null;

  return (
    <section className="mb-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {moments.map((m) => {
          const inner = (
            <>
              <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-1">{m.type}</p>
              <p className="text-[12px] font-medium text-zinc-100 leading-snug">{m.headline}</p>
              <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2">{m.detail}</p>
            </>
          );
          const cls = TYPE_STYLES[m.type] ?? TYPE_STYLES.rivalry;
          if (m.href) {
            return (
              <Link
                key={m.id}
                href={m.href}
                className={`rounded-xl border px-3 py-2.5 feed-hover-lift transition ${cls}`}
              >
                {inner}
              </Link>
            );
          }
          return (
            <div key={m.id} className={`rounded-xl border px-3 py-2.5 ${cls}`}>
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}
