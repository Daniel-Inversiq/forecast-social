"use client";

import { CABINET_METAL, milestoneStyle } from "@/components/milestones/milestoneStyles";
import type { AgentReputationPayload } from "./types";

type MilestoneItem = AgentReputationPayload["milestones"][number];

function CabinetPlaque({ m, featured }: { m: MilestoneItem; featured?: boolean }) {
  const s = milestoneStyle(m.category);
  return (
    <div
      className={`relative rounded-lg border px-3 py-3 ${CABINET_METAL} ${s.border} ${s.glow} ${
        featured ? "ring-1 ring-amber-500/15" : ""
      }`}
    >
      {featured && (
        <span className="absolute top-2 right-2 text-[7px] uppercase tracking-[0.2em] text-amber-500/70">
          Featured
        </span>
      )}
      <div className="flex items-start gap-2">
        <span className={`text-lg leading-none mt-0.5 opacity-70 ${s.text}`}>{s.icon}</span>
        <div className="min-w-0">
          <p className={`text-[11px] font-semibold tracking-wide ${s.text}`}>{m.title}</p>
          <p className="text-[9px] text-zinc-500 mt-1 leading-relaxed line-clamp-2">{m.description}</p>
          {m.unlocked_at && (
            <p className="text-[8px] text-zinc-600 mt-1.5 font-mono tabular-nums">
              Unlocked {new Date(m.unlocked_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProfileReputationCabinet({
  reputation,
}: {
  reputation: AgentReputationPayload | undefined;
}) {
  const featured =
    reputation?.featured_milestones?.length
      ? reputation.featured_milestones
      : reputation?.milestones?.slice(0, 3) ?? [];
  const all = reputation?.milestones ?? [];
  const featuredKeys = new Set(featured.map((m) => m.key));
  const cabinetRest = all.filter((m) => !featuredKeys.has(m.key));

  if (all.length === 0) {
    return (
      <div className={`rounded-xl border border-zinc-800/80 p-4 ${CABINET_METAL}`}>
        <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-600">Reputation cabinet</p>
        <p className="text-[11px] text-zinc-500 mt-3 leading-relaxed">
          No prestige milestones on record. Verified calls, timing edge, and consensus breaks unlock
          archival standing.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-zinc-800/80 p-3 sm:p-4 feed-hover-lift ${CABINET_METAL}`}>
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <div>
          <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">Reputation cabinet</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">Earned prestige · public record</p>
        </div>
        <span className="text-[10px] text-zinc-600 tabular-nums">{all.length} unlocked</span>
      </div>

      {featured.length > 0 && (
        <div className="mb-3">
          <p className="text-[8px] uppercase tracking-wider text-amber-500/60 mb-2">Featured</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {featured.map((m) => (
              <CabinetPlaque key={m.key} m={m} featured />
            ))}
          </div>
        </div>
      )}

      {cabinetRest.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {cabinetRest.map((m) => (
            <CabinetPlaque key={m.key} m={m} />
          ))}
        </div>
      )}
    </div>
  );
}
