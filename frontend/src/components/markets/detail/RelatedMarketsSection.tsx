"use client";

import Link from "next/link";
import {
  getMarketProbState,
  MARKET_PROB_STYLES,
} from "@/components/markets/marketProbability";
import { titleToSlug } from "@/lib/slugs";
import type { MarketBase } from "../types";

export function RelatedMarketsSection({ markets }: { markets: MarketBase[] }) {
  if (markets.length === 0) return null;

  return (
    <section className="mt-6 pt-5 border-t border-zinc-800/60">
      <h2 className="text-[12px] font-semibold text-zinc-300 mb-2">Related markets</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5">
        {markets.map((m) => {
          const slug = m.slug ?? titleToSlug(m.title);
          const prob = Math.round(m.current_yes_probability);
          const { tone, label } = getMarketProbState(prob);
          const colors = MARKET_PROB_STYLES[tone];

          return (
            <Link
              key={slug}
              href={`/markets/${slug}`}
              className="block rounded-md border border-zinc-800/70 bg-zinc-950/60 p-2 hover:border-zinc-700 hover:bg-zinc-900/40 transition"
            >
              <p className="text-[11px] font-medium text-zinc-300 leading-snug line-clamp-2 hover:text-white">
                {m.title}
              </p>
              <p className="mt-1.5 flex items-baseline gap-1">
                <span className={`text-[14px] font-semibold tabular-nums ${colors.text}`}>
                  {prob}%
                </span>
                <span className={`text-[10px] font-medium ${colors.label}`}>{label}</span>
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
