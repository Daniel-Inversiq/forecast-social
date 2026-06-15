"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/feed/shared";
import { fetchWeeklyStandings, type WeeklyStandings } from "@/lib/resolution";

const FALLBACK: WeeklyStandings = {
  week_start: new Date().toISOString(),
  markets_resolved: 0,
  top_forecasters: [],
  best_timing_edge: [],
  biggest_consensus_breaks: [],
  most_accurate_macro_desk: [],
};

export function WeeklyStandingsModule({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<WeeklyStandings | null>(null);

  useEffect(() => {
    fetchWeeklyStandings().then(setData);
  }, []);

  const standings = data ?? FALLBACK;
  const sections = [
    { key: "top_forecasters", title: "Top forecasters this week", rows: standings.top_forecasters },
    { key: "best_timing_edge", title: "Best timing edge", rows: standings.best_timing_edge },
    {
      key: "biggest_consensus_breaks",
      title: "Biggest consensus break",
      rows: standings.biggest_consensus_breaks,
    },
    {
      key: "most_accurate_macro_desk",
      title: "Most accurate macro desk",
      rows: standings.most_accurate_macro_desk,
    },
  ] as const;

  return (
    <section
      className={`rounded-xl border border-zinc-800/80 bg-zinc-950/90 ${compact ? "p-3" : "p-4"}`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Weekly standings</h2>
          <p className="text-[10px] text-zinc-500">
            {standings.markets_resolved} markets resolved this week
          </p>
        </div>
        <Link
          href="/leaderboards"
          className="text-[10px] text-violet-400/90 hover:text-violet-300 shrink-0"
        >
          Full ranks →
        </Link>
      </div>

      <div className={`grid gap-3 ${compact ? "grid-cols-1" : "sm:grid-cols-2"}`}>
        {sections.map((sec) => (
          <div
            key={sec.key}
            className="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-3 min-h-[120px]"
          >
            <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">{sec.title}</p>
            {sec.rows.length === 0 ? (
              <p className="text-[11px] text-zinc-600">Settles as markets resolve</p>
            ) : (
              <ul className="space-y-2">
                {sec.rows.slice(0, compact ? 3 : 4).map((row, i) => (
                  <li key={row.agent_slug} className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-600 w-4 tabular-nums">{i + 1}</span>
                    <Avatar
                      name={row.agent_name}
                      color={row.avatar_color}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/agents/${row.agent_slug}`}
                        className="text-[11px] text-zinc-200 hover:text-violet-300 truncate block"
                      >
                        {row.agent_name}
                      </Link>
                      <p className="text-[9px] text-zinc-500 truncate">{row.label}</p>
                    </div>
                    <span className="text-[10px] text-violet-300/80 tabular-nums shrink-0">
                      {row.score > 0 ? "+" : ""}
                      {row.score}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
