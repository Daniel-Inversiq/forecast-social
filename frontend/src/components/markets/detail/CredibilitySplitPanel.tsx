"use client";

import Link from "next/link";
import type { CredibilitySplit } from "./types";

function SideColumn({
  side,
  stats,
  tone,
}: {
  side: "YES" | "NO";
  stats: CredibilitySplit["yes"];
  tone: "violet" | "zinc";
}) {
  const border = tone === "violet" ? "border-violet-500/25 bg-violet-950/20" : "border-zinc-700/50 bg-zinc-900/40";
  const accent = tone === "violet" ? "text-violet-300" : "text-zinc-300";

  return (
    <div className={`rounded-lg border p-3 ${border}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-bold ${accent}`}>{side}</span>
        <span className="text-[10px] text-zinc-500 tabular-nums">{stats.agent_count} agents</span>
      </div>
      <p className="text-2xl font-semibold text-white tabular-nums mb-1">
        {Math.round(stats.total_reputation)}
        <span className="text-[10px] text-zinc-500 font-normal ml-1">rep pts</span>
      </p>
      <dl className="grid grid-cols-2 gap-2 text-[10px] mb-2">
        <div>
          <dt className="text-zinc-600">Timing</dt>
          <dd className="text-zinc-200 tabular-nums">{stats.avg_timing_quality || "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">Calibration</dt>
          <dd className="text-zinc-200 tabular-nums">{stats.avg_calibration || "—"}</dd>
        </div>
      </dl>
      {stats.strongest_agent ? (
        <Link
          href={`/agents/${stats.strongest_agent.slug}`}
          className="block text-[10px] text-emerald-400/90 hover:text-emerald-300"
        >
          Strongest · {stats.strongest_agent.name} ({Math.round(stats.strongest_agent.reputation_score)} rep)
        </Link>
      ) : (
        <p className="text-[10px] text-zinc-600">No positioned agents</p>
      )}
    </div>
  );
}

export function CredibilitySplitPanel({ credibility }: { credibility: CredibilitySplit }) {
  const mov =
    credibility.movement_type === "contrarian_led"
      ? { label: "Contrarian-led", tone: "text-fuchsia-300 border-fuchsia-500/30 bg-fuchsia-500/10" }
      : credibility.movement_type === "consensus_led"
        ? { label: "Consensus-led", tone: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" }
        : { label: "Mixed pressure", tone: "text-amber-300 border-amber-500/30 bg-amber-500/10" };

  return (
    <section className="mb-3 rounded-xl border border-zinc-800/80 bg-zinc-950/90 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-zinc-800/70 bg-gradient-to-r from-emerald-950/25 via-zinc-950 to-violet-950/20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-semibold text-white">Credibility split</h2>
            <p className="text-[10px] text-zinc-600">Reputation weight behind each side — not just probability</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full border ${mov.tone}`}>
              {mov.label}
            </span>
            {credibility.consensus_breaking && (
              <span className="text-[8px] uppercase tracking-wider text-fuchsia-300/90 border border-fuchsia-500/30 bg-fuchsia-500/10 px-1.5 py-0.5 rounded">
                Consensus break
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="p-3 grid sm:grid-cols-2 gap-3">
        <SideColumn side="YES" stats={credibility.yes} tone="violet" />
        <SideColumn side="NO" stats={credibility.no} tone="zinc" />
      </div>
    </section>
  );
}
