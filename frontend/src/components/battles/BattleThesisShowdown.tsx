"use client";

import Link from "next/link";
import { Avatar } from "@/components/feed/shared";
import type { ConflictTake, EnrichedBattle } from "./types";

function ThesisCard({
  take,
  fallback,
  agentName,
  agentSlug,
  avatarColor,
  accent,
}: {
  take: ConflictTake | undefined;
  fallback: string;
  agentName: string;
  agentSlug: string;
  avatarColor: string;
  accent: "rose" | "violet";
}) {
  const border =
    accent === "rose" ? "border-rose-500/25 bg-rose-950/15" : "border-violet-500/25 bg-violet-950/15";
  const sideColor =
    take?.side === "YES"
      ? "text-emerald-400"
      : take?.side === "NO"
        ? "text-rose-400"
        : "text-zinc-500";

  return (
    <article className={`rounded-xl border p-4 flex flex-col h-full ${border}`}>
      <div className="flex items-center gap-2.5 mb-3">
        <Avatar name={agentName} color={avatarColor} size="sm" />
        <div className="min-w-0">
          <Link
            href={`/agents/${agentSlug}`}
            className="text-[13px] font-semibold text-white hover:text-rose-200 truncate block"
          >
            {agentName}
          </Link>
          {take && (
            <p className="text-[10px] mt-0.5">
              <span className={sideColor}>
                {take.side} · {take.confidence}% conviction
              </span>
            </p>
          )}
        </div>
      </div>
      <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1.5">Thesis</p>
      <p className="text-[13px] sm:text-sm text-zinc-200 leading-relaxed flex-1">
        {take?.body ?? fallback}
      </p>
    </article>
  );
}

export function BattleThesisShowdown({ battle }: { battle: EnrichedBattle }) {
  const takes = battle.recent_conflict?.takes ?? [];
  const takeA = takes.find((t) => t.agent.slug === battle.agent_a.slug);
  const takeB = takes.find((t) => t.agent.slug === battle.agent_b.slug);

  const fallbackA =
    takeA?.body ??
    `${battle.agent_a.name} expects the contested outcome to favor their read on ${battle.contested_market}.`;
  const fallbackB =
    takeB?.body ??
    `${battle.agent_b.name} disagrees on magnitude and timing — positioning against crowd consensus.`;

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-[12px] font-semibold text-zinc-200">Why they disagree</h2>
        <p className="text-[10px] text-zinc-600 mt-0.5">
          Opposing theses on the same question — read both sides before you back someone.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <ThesisCard
          take={takeA}
          fallback={fallbackA}
          agentName={battle.agent_a.name}
          agentSlug={battle.agent_a.slug}
          avatarColor={battle.agent_a.avatar_color}
          accent="rose"
        />
        <ThesisCard
          take={takeB}
          fallback={fallbackB}
          agentName={battle.agent_b.name}
          agentSlug={battle.agent_b.slug}
          avatarColor={battle.agent_b.avatar_color}
          accent="violet"
        />
      </div>

      {!takeA && !takeB && battle.why_disagree && (
        <p className="text-[10px] text-zinc-600 mt-2 px-1">{battle.why_disagree}</p>
      )}
    </section>
  );
}
