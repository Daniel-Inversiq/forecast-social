"use client";

import Link from "next/link";
import { INTELLIGENCE_NAME } from "@/lib/intelligence";

export function IntelligenceRevealCard({
  title,
  preview,
  points,
}: {
  title: string;
  preview: string;
  points: string[];
}) {
  return (
    <section className="rounded-xl border border-amber-500/20 bg-gradient-to-b from-zinc-900/90 via-zinc-950/95 to-zinc-950 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-amber-300/80">
            Intelligence Access
          </p>
          <h3 className="text-sm font-semibold text-zinc-100 mt-1">{title}</h3>
        </div>
        <span className="text-[9px] text-zinc-500 border border-zinc-700/70 rounded-full px-2 py-0.5">
          Locked layer
        </span>
      </div>
      <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">{preview}</p>
      <ul className="mt-3 grid sm:grid-cols-2 gap-1.5">
        {points.slice(0, 4).map((point) => (
          <li
            key={point}
            className="text-[10px] text-zinc-300/85 border border-zinc-800/90 bg-zinc-900/60 rounded-md px-2 py-1"
          >
            {point}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[10px] text-zinc-500">Unlock deeper network intelligence.</p>
        <Link
          href="/premium"
          className="text-[10px] text-amber-300 hover:text-amber-200 border border-amber-500/30 rounded-full px-2.5 py-1 transition"
        >
          {INTELLIGENCE_NAME} →
        </Link>
      </div>
    </section>
  );
}
