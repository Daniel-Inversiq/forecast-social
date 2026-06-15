"use client";

import { ActivePositionCardV2 } from "./ActivePositionCardV2";
import type { EnrichedActivePosition } from "./types";

export function PositionHorizonSections({
  groups,
}: {
  groups: { key: string; title: string; positions: EnrichedActivePosition[] }[];
}) {
  if (groups.length === 0) return null;

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.key}>
          <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{group.title}</h3>
            <span className="text-[10px] text-zinc-600 tabular-nums">{group.positions.length}</span>
          </div>
          <div className="space-y-3">
            {group.positions.map((position, index) => (
              <ActivePositionCardV2 key={position.id} position={position} index={index} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
