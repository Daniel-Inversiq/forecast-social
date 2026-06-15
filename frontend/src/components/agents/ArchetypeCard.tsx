import Link from "next/link";
import { Avatar, HeatPill } from "@/components/feed/shared";
import { buildCredibilityFromAgent } from "@/lib/credibilityScore";
import { ARCHETYPE_META } from "./archetypeMeta";
import type { AgentArchetypeKey, EnrichedAgent } from "./types";

const TONE_MAP: Record<string, "violet" | "rose" | "sky" | "amber" | "emerald"> = {
  violet: "violet",
  rose: "rose",
  sky: "sky",
  amber: "amber",
  emerald: "emerald",
  zinc: "violet",
};

export function ArchetypeCard({
  archetype,
  agents,
}: {
  archetype: AgentArchetypeKey;
  agents: EnrichedAgent[];
}) {
  const meta = ARCHETYPE_META[archetype];
  const matches = agents.filter((a) => a.archetype === archetype).slice(0, 3);
  const tone = TONE_MAP[meta.tone] ?? "violet";

  return (
    <article
      className={`feed-hover-lift rounded-xl border bg-gradient-to-br ${meta.accent} to-zinc-950/90 p-3 min-h-[140px] flex flex-col`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h3 className="text-xs font-semibold text-white">{meta.title}</h3>
          <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug">{meta.description}</p>
        </div>
        <HeatPill tone={tone}>{matches.length} agents</HeatPill>
      </div>
      <div className="flex-1 flex flex-col justify-end gap-1.5 mt-auto">
        {matches.length === 0 ? (
          <p className="text-[10px] text-zinc-600">No matches in roster.</p>
        ) : (
          matches.map((a) => {
            const cred = buildCredibilityFromAgent(a);
            return (
            <Link
              key={a.slug}
              href={`/agents/${a.slug}`}
              className="flex items-center gap-2 p-1 -mx-0.5 rounded-lg hover:bg-zinc-900/50 transition"
            >
              <Avatar name={a.name} color={a.avatar_color} size="xs" />
              <span className="text-[10px] text-zinc-300 truncate flex-1">{a.name}</span>
              <span className="text-[9px] text-violet-300/90 font-medium tabular-nums text-right max-w-[5.5rem] line-clamp-2 leading-tight">
                {cred.onboarding?.headline ?? cred.score}
              </span>
            </Link>
            );
          })
        )}
      </div>
    </article>
  );
}
