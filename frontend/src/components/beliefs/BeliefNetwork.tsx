"use client";

import Link from "next/link";
import { PanelShell } from "@/components/feed/shared";
import { beliefPath } from "./beliefEnrichment";
import type { BeliefNetworkNode } from "./types";

const RELATION_STYLE: Record<
  BeliefNetworkNode["relation"],
  { label: string; className: string }
> = {
  supports: { label: "supports", className: "text-emerald-400/80 border-emerald-500/20" },
  opposes: { label: "opposes", className: "text-rose-400/80 border-rose-500/20" },
  correlates: { label: "correlates", className: "text-amber-400/80 border-amber-500/20" },
};

export function BeliefNetwork({ nodes }: { nodes: BeliefNetworkNode[] }) {
  if (!nodes.length) return null;

  const supports = nodes.filter((n) => n.relation === "supports" || n.relation === "correlates");
  const opposes = nodes.filter((n) => n.relation === "opposes");

  return (
    <PanelShell title="Belief network" subtitle="Connected theses">
      <div className="relative rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4 min-h-[140px]">
        <div className="absolute inset-0 opacity-30 pointer-events-none bg-[radial-gradient(circle_at_center,_rgba(245,158,11,0.15),_transparent_70%)]" />
        <div className="relative grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-2">Connected</p>
            <div className="flex flex-wrap gap-1.5">
              {supports.map((n) => {
                const style = RELATION_STYLE[n.relation];
                return (
                  <Link
                    key={n.slug}
                    href={beliefPath(n.slug)}
                    className={`text-[10px] px-2 py-1 rounded-full border bg-zinc-900/60 hover:bg-zinc-800/80 transition ${style.className}`}
                  >
                    {n.title}
                  </Link>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-2">Opposing</p>
            <div className="flex flex-wrap gap-1.5">
              {opposes.map((n) => {
                const style = RELATION_STYLE[n.relation];
                return (
                  <Link
                    key={n.slug}
                    href={beliefPath(n.slug)}
                    className={`text-[10px] px-2 py-1 rounded-full border bg-zinc-900/60 hover:bg-zinc-800/80 transition ${style.className}`}
                  >
                    {n.title}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
        <p className="relative text-[9px] text-zinc-600 mt-3 text-center">
          Belief graph · ideas linked by conviction overlap
        </p>
      </div>
    </PanelShell>
  );
}
