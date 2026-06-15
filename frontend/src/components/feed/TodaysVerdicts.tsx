"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { FeedEvent } from "./feedMix";
import type { StreamBattle } from "@/lib/useFeedStream";
import { Avatar } from "./shared";
import { deriveTodaysVerdicts, type VerdictSlot } from "./todaysVerdictsModel";

const slotAccent: Record<VerdictSlot["kind"], { kicker: string; border: string; stat: string }> = {
  called_it: {
    kicker: "text-emerald-400/90",
    border: "border-emerald-500/20 hover:border-emerald-400/40",
    stat: "text-emerald-300",
  },
  exposed: {
    kicker: "text-rose-400/90",
    border: "border-rose-500/20 hover:border-rose-400/40",
    stat: "text-rose-300",
  },
  mover: {
    kicker: "text-amber-400/90",
    border: "border-amber-500/20 hover:border-amber-400/40",
    stat: "text-amber-300",
  },
  battle: {
    kicker: "text-violet-400/90",
    border: "border-violet-500/20 hover:border-violet-400/40",
    stat: "text-violet-300",
  },
};

function VerdictTile({ slot }: { slot: VerdictSlot }) {
  const accent = slotAccent[slot.kind];
  return (
    <Link
      href={slot.href}
      className={`group flex flex-col gap-1.5 min-w-0 rounded-xl border ${accent.border} scry-surface-section p-3 transition feed-hover-lift`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[10px] font-bold uppercase tracking-[0.14em] ${accent.kicker}`}
        >
          {slot.kicker}
        </span>
        {slot.stat && (
          <span className={`text-[12px] font-bold tabular-nums shrink-0 ${accent.stat}`}>
            {slot.stat}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <Avatar name={slot.agent.name} color={slot.agent.avatar_color} size="xs" />
        <span className="text-[13px] font-semibold text-zinc-100 truncate">
          {slot.agent.name}
        </span>
        {slot.opponent && (
          <>
            <span className="text-[10px] font-bold text-zinc-600 shrink-0">vs</span>
            <span className="text-[13px] font-semibold text-zinc-100 truncate">
              {slot.opponent.name}
            </span>
          </>
        )}
      </div>
      {slot.line && (
        <p className="text-[12px] leading-snug text-zinc-400 line-clamp-2 group-hover:text-zinc-300 transition-colors">
          {slot.line}
        </p>
      )}
    </Link>
  );
}

/**
 * The daily verdict block — who was right, who got exposed, who's moving,
 * who's fighting. Renders only from real loaded events; hides itself when the
 * day has no verdicts yet.
 */
export function TodaysVerdicts({
  events,
  streamBattles = [],
  className = "",
}: {
  events: FeedEvent[];
  streamBattles?: StreamBattle[];
  className?: string;
}) {
  const { slots, resolvingSoonCount } = useMemo(
    () => deriveTodaysVerdicts(events, streamBattles),
    [events, streamBattles],
  );

  if (slots.length < 2) return null;

  const cols =
    slots.length >= 4
      ? "sm:grid-cols-2 xl:grid-cols-4"
      : slots.length === 3
        ? "sm:grid-cols-3"
        : "sm:grid-cols-2";

  return (
    <section className={`feed-fade-in ${className}`} aria-label="Today's verdicts">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <h2 className="text-[13px] font-bold tracking-tight text-zinc-200 uppercase">
          Today&apos;s verdicts
        </h2>
        {resolvingSoonCount > 0 && (
          <span className="text-[11px] text-amber-300/90 font-medium">
            ⚡ {resolvingSoonCount} call{resolvingSoonCount === 1 ? "" : "s"} resolving soon
          </span>
        )}
      </div>
      <div className={`grid grid-cols-1 ${cols} gap-2`}>
        {slots.map((slot) => (
          <VerdictTile key={slot.kind} slot={slot} />
        ))}
      </div>
    </section>
  );
}
