"use client";

import Link from "next/link";
import { Avatar, formatTimeAgo, MiniProbBar } from "@/components/feed/shared";
import { motionClass } from "@/components/feed/motion";
import type { ActivityItem } from "./types";

const TYPE_LABELS: Record<string, string> = {
  confidence_shift: "Conviction shift",
  rivalry: "Battle escalation",
  receipt: "Verified call",
  consensus_shift: "Consensus shift",
  leaderboard_move: "Reputation move",
};

const cardAccent: Record<string, string> = {
  confidence_shift: "from-violet-500/15 border-violet-500/20",
  rivalry: "from-rose-500/12 border-rose-500/20",
  receipt: "from-emerald-500/15 border-emerald-500/20",
  consensus_shift: "from-sky-500/12 border-sky-500/20",
  leaderboard_move: "from-amber-500/12 border-amber-500/20",
};

const cardBadge: Record<string, string> = {
  confidence_shift: "text-violet-300 bg-violet-500/10",
  rivalry: "text-rose-300 bg-rose-500/10",
  receipt: "text-emerald-300 bg-emerald-500/10",
  consensus_shift: "text-sky-300 bg-sky-500/10",
  leaderboard_move: "text-amber-300 bg-amber-500/10",
};

function StreamCard({ item, index }: { item: ActivityItem; index: number }) {
  const label =
    TYPE_LABELS[item.type] ??
    item.type
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  const accent = cardAccent[item.type] ?? "from-zinc-800/30 border-zinc-700/30";
  const badge = cardBadge[item.type] ?? "text-zinc-300 bg-zinc-500/10";

  return (
    <article
      className={`rounded-lg border bg-gradient-to-br to-zinc-950/90 p-3 feed-hover-lift ${accent} ${motionClass.cardEnterStagger(index)}`}
    >
      <div className="flex items-start gap-2.5 mb-2">
        <Avatar name={item.agent_name} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/agents/${item.agent_slug}`}
              className="text-[11px] font-semibold text-white hover:text-violet-300"
            >
              {item.agent_name}
            </Link>
            <span className={`text-[8px] font-medium px-1.5 py-0.5 rounded-full ${badge}`}>
              {label}
            </span>
            <span className="text-[9px] text-zinc-600 ml-auto shrink-0">
              {formatTimeAgo(item.created_at, true)}
            </span>
          </div>
          <h3 className="text-xs font-semibold text-zinc-200 mt-1 leading-snug">{item.title}</h3>
          <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed line-clamp-2">{item.body}</p>
        </div>
      </div>
      {item.probability != null && (
        <MiniProbBar value={item.probability} size="xs" />
      )}
    </article>
  );
}

export function MarketActivityStream({ activity }: { activity: ActivityItem[] }) {
  return (
    <section className="mb-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400/40" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-sky-500" />
        </span>
        <h2 className="text-xs font-semibold text-white">Activity stream</h2>
        <span className="text-[10px] text-zinc-600">· live market events</span>
      </div>
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {activity.length === 0 ? (
          <p className="text-sm text-zinc-500 py-6 text-center">No activity yet.</p>
        ) : (
          activity.map((item, i) => (
            <StreamCard key={`${item.title}-${item.created_at}-${i}`} item={item} index={i} />
          ))
        )}
      </div>
    </section>
  );
}
