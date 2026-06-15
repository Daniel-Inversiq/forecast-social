"use client";

import Link from "next/link";
import type { RabbitHole } from "@/lib/search";

const STAGE_COLORS: Record<string, string> = {
  forming: "text-zinc-400 border-zinc-600/50",
  breaking: "text-amber-400 border-amber-500/40",
  heating: "text-rose-400 border-rose-500/40",
  fragmenting: "text-violet-400 border-violet-500/40",
  emerging: "text-teal-400 border-teal-500/40",
};

export function RabbitHoleCard({ hole }: { hole: RabbitHole }) {
  const stageClass = STAGE_COLORS[hole.signal_stage] ?? STAGE_COLORS.forming;

  return (
    <article className="scry-rabbit-hole group relative rounded-xl border border-zinc-800/80 bg-zinc-900/25 p-4 hover:border-violet-500/25 transition overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.04] to-transparent pointer-events-none" />
      <Link href={hole.href} className="block relative">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-sm font-medium text-zinc-100 group-hover:text-violet-200 transition leading-snug">
            {hole.title}
          </h3>
          <span
            className={`shrink-0 text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border font-mono ${stageClass}`}
          >
            {hole.signal_stage}
          </span>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed mb-3">{hole.hook}</p>
      </Link>

      <div className="relative space-y-2.5 text-[10px]">
        <div className="flex flex-wrap gap-1">
          <span className="text-zinc-600">Season</span>
          <span className="text-amber-500/80">{hole.season}</span>
        </div>

        <EntityRow label="Agents">
          {hole.agents.map((a) => (
            <Link
              key={a.slug}
              href={`/agents/${a.slug}`}
              className="text-violet-400/90 hover:text-violet-300"
            >
              {a.name}
            </Link>
          ))}
        </EntityRow>

        <EntityRow label="Markets">
          {hole.markets.map((m) => (
            <Link
              key={m.slug}
              href={`/markets/${m.slug}`}
              className="text-teal-400/90 hover:text-teal-300 truncate max-w-[200px] inline-block"
            >
              {m.title}
            </Link>
          ))}
        </EntityRow>

        <EntityRow label="Battles">
          {hole.battles.map((b) => (
            <Link key={b.href} href={b.href} className="text-rose-400/90 hover:text-rose-300">
              {b.label}
            </Link>
          ))}
        </EntityRow>

        <EntityRow label="Verified">
          {hole.verified_calls.map((v) => (
            <Link key={v.href} href={v.href} className="text-emerald-400/90 hover:text-emerald-300">
              {v.label}
            </Link>
          ))}
        </EntityRow>
      </div>

      <Link
        href={hole.href}
        className="relative mt-3 inline-flex text-[10px] text-zinc-600 hover:text-violet-400 font-mono transition"
      >
        Enter rabbit hole →
      </Link>
    </article>
  );
}

function EntityRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span className="text-zinc-700 uppercase tracking-wider text-[8px] w-14 shrink-0">{label}</span>
      <span className="flex flex-wrap gap-x-2 gap-y-0.5">{children}</span>
    </div>
  );
}
