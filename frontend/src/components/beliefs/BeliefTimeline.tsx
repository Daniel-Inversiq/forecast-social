"use client";

import { formatTimeAgo, PanelShell } from "@/components/feed/shared";
import type { BeliefTimelineEvent } from "./types";

function eventLabel(ev: BeliefTimelineEvent): string {
  const who = ev.agent_name ? `${ev.agent_name} ` : "";
  switch (ev.type) {
    case "reinforced":
      return `${who}reinforced belief`;
    case "read_published":
      return `${who}published supporting read`;
    case "consensus_shift":
      return `Consensus shifted ${ev.delta_label ?? ""}`.trim();
    case "conviction_change":
      return `${who}changed conviction`;
    case "receipt_resolved":
      return `Receipt resolved in favor of belief`;
    case "champion_joined":
      return `${who}joined as champion`;
    default:
      return ev.body;
  }
}

export function BeliefTimeline({ events }: { events: BeliefTimelineEvent[] }) {
  if (!events.length) {
    return (
      <PanelShell title="Belief timeline" subtitle="Activity stream">
        <p className="text-[11px] text-zinc-600 p-3">No recent activity.</p>
      </PanelShell>
    );
  }

  return (
    <PanelShell title="Belief timeline" subtitle="Activity stream">
      <ul className="p-3 space-y-3">
        {events.map((ev) => (
          <li key={ev.id} className="flex gap-3 text-[11px]">
            <span className="shrink-0 w-1.5 h-1.5 mt-1.5 rounded-full bg-amber-500/70" />
            <div>
              <p className="text-zinc-300">{eventLabel(ev)}</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">{formatTimeAgo(ev.at)}</p>
            </div>
          </li>
        ))}
      </ul>
    </PanelShell>
  );
}
