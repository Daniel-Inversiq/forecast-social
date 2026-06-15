"use client";

import Link from "next/link";
import { PanelShell } from "@/components/feed/shared";
import { buildPulseItems } from "./signalIntelligence";
import type { EnrichedNarrative } from "./types";

const PULSE_TONE: Record<string, string> = {
  amber: "border-l-amber-500/60",
  violet: "border-l-violet-500/60",
  teal: "border-l-teal-500/60",
  rose: "border-l-rose-500/50",
  emerald: "border-l-emerald-500/55",
};

export function SignalIntelligenceSidebar({
  narratives,
  className = "hidden lg:block sticky top-[52px] self-start max-h-[calc(100vh-4rem)] overflow-y-auto scrollbar-none",
}: {
  narratives: EnrichedNarrative[];
  className?: string;
}) {
  const pulse = buildPulseItems(narratives);
  const accelerating = [...narratives].sort(
    (a, b) => b.narrative_acceleration - a.narrative_acceleration,
  );
  const hidden = [...narratives].sort((a, b) => b.coordination_score - a.coordination_score);
  const fracturing = [...narratives]
    .filter((n) => n.is_contrarian)
    .sort((a, b) => a.alignment - b.alignment);

  return (
    <aside className={`space-y-3 feed-intel-rail ${className}`}>
      <PanelShell
        title="Live signal pulse"
        subtitle="Pressure · coalitions · fragmentation"
        headerClass="!py-1.5 border-b border-amber-500/10"
      >
        <ul className="p-1.5 space-y-0.5 max-h-[280px] overflow-y-auto scrollbar-none">
          {pulse.map((item) => (
            <li
              key={item.id}
              className={`border-l-2 pl-2 py-1.5 text-[10px] text-zinc-400 leading-snug ${PULSE_TONE[item.tone]}`}
            >
              <span className="text-zinc-600 tabular-nums text-[9px] mr-1">{item.time_ago}</span>
              {item.copy}
            </li>
          ))}
        </ul>
      </PanelShell>

      <PanelShell title="Pressure shifts" subtitle="Fastest acceleration" headerClass="!py-1.5">
        <ul className="p-1.5 space-y-0.5">
          {accelerating.slice(0, 4).map((n) => (
            <li key={n.id}>
              <p className="text-[10px] text-zinc-300 line-clamp-1">{n.title}</p>
              <p className="text-[9px] text-amber-400/80 tabular-nums mt-0.5">
                +{n.narrative_acceleration.toFixed(1)} accel · {n.signal_stage}
              </p>
            </li>
          ))}
        </ul>
      </PanelShell>

      <PanelShell title="Hidden alignment" subtitle="High coordination" headerClass="!py-1.5">
        <ul className="p-1.5 space-y-0.5">
          {hidden.slice(0, 3).map((n) => (
            <li key={n.id}>
              <p className="text-[10px] text-violet-200/80 line-clamp-1">{n.title}</p>
              <p className="text-[9px] text-zinc-600 mt-0.5">
                {n.coordination_score}% · {n.rep_weight} rep
              </p>
            </li>
          ))}
        </ul>
      </PanelShell>

      <PanelShell title="Fragmentation alerts" subtitle="Consensus breaking" headerClass="!py-1.5">
        <ul className="p-1.5 space-y-0.5">
          {fracturing.slice(0, 3).map((n) => (
            <li key={n.id}>
              <p className="text-[10px] text-zinc-300 line-clamp-1">{n.title}</p>
              <p className="text-[9px] text-rose-400/70 tabular-nums mt-0.5">
                {n.alignment}% consensus
              </p>
            </li>
          ))}
        </ul>
      </PanelShell>

      <PanelShell title="Verification forming" subtitle="Pre-mainstream" headerClass="!py-1.5">
        <ul className="p-1.5 space-y-0.5">
          {[...narratives]
            .filter((n) => n.signal_stage === "BREAKOUT" || n.signal_stage === "CLUSTERING")
            .slice(0, 3)
            .map((n) => (
              <li key={n.id}>
                <Link
                  href="/verified-calls"
                  className="block text-[10px] text-zinc-300 hover:text-teal-300/90 line-clamp-1 transition"
                >
                  {n.title}
                </Link>
                <p className="text-[9px] text-teal-400/70 mt-0.5">{n.lifecycle_phase.replace(/_/g, " ")}</p>
              </li>
            ))}
        </ul>
      </PanelShell>
    </aside>
  );
}
