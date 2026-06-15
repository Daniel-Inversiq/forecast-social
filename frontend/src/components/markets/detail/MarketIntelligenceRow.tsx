"use client";

import Link from "next/link";
import type { IntelligenceWidget } from "./types";

const TONE_RING: Record<IntelligenceWidget["tone"], string> = {
  violet: "border-violet-500/25 hover:border-violet-500/40 from-violet-950/30",
  rose: "border-rose-500/25 hover:border-rose-500/40 from-rose-950/25",
  emerald: "border-emerald-500/25 hover:border-emerald-500/40 from-emerald-950/25",
  amber: "border-amber-500/25 hover:border-amber-500/40 from-amber-950/25",
  sky: "border-sky-500/25 hover:border-sky-500/40 from-sky-950/25",
};

const TONE_VALUE: Record<IntelligenceWidget["tone"], string> = {
  violet: "text-violet-300",
  rose: "text-rose-300",
  emerald: "text-emerald-300",
  amber: "text-amber-300",
  sky: "text-sky-300",
};

function WidgetCard({ w }: { w: IntelligenceWidget }) {
  const inner = (
    <>
      <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-1">{w.label}</p>
      <p className={`text-xs font-semibold truncate ${TONE_VALUE[w.tone]}`}>{w.value}</p>
      <p className="text-[9px] text-zinc-500 mt-0.5 truncate">{w.sub}</p>
    </>
  );

  const cls = `rounded-lg border bg-gradient-to-br to-zinc-950/90 p-2.5 transition feed-hover-lift ${TONE_RING[w.tone]}`;

  if (w.href) {
    return (
      <Link href={w.href} className={`block min-w-0 ${cls}`}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}

const PRIORITY_IDS = ["bullish", "contrarian", "movement", "reputation"];

export function MarketIntelligenceRow({
  widgets,
  maxItems = 4,
}: {
  widgets: IntelligenceWidget[];
  maxItems?: number;
}) {
  const prioritized = [
    ...widgets.filter((w) => PRIORITY_IDS.includes(w.id)),
    ...widgets.filter((w) => !PRIORITY_IDS.includes(w.id)),
  ].slice(0, maxItems);

  return (
    <section className="mb-4">
      <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-600 mb-2">Key intelligence</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {prioritized.map((w) => (
          <WidgetCard key={w.id} w={w} />
        ))}
      </div>
    </section>
  );
}
