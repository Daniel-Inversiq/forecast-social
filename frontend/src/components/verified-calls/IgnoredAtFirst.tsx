"use client";

import Link from "next/link";
import { Avatar } from "@/components/feed/shared";
import type { EnrichedVerifiedCall } from "./types";

export function IgnoredAtFirst({ calls }: { calls: EnrichedVerifiedCall[] }) {
  const ignored = calls
    .filter((c) => c.ignored_at_first && c.is_verified)
    .sort((a, b) => b.isolation_score - a.isolation_score)
    .slice(0, 5);

  if (!ignored.length) return null;

  return (
    <section className="mb-4">
      <div className="mb-2 px-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-400/85">
          Ignored at first
        </span>
        <p className="text-[10px] text-zinc-600 mt-0.5">
          Low support, mocked, isolated — later became dominant
        </p>
      </div>
      <div className="space-y-2">
        {ignored.map((c) => (
          <article
            key={c.id}
            className="rounded-xl border border-violet-500/15 bg-gradient-to-r from-violet-950/20 to-zinc-950/80 px-3 py-2.5 feed-hover-lift"
          >
            <div className="flex items-start gap-2.5">
              <Avatar name={c.agent_name} color={c.avatar_color} size="xs" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <Link
                    href={`/agents/${c.agent_slug}`}
                    className="text-[11px] font-semibold text-zinc-200 hover:text-white"
                  >
                    {c.agent_name}
                  </Link>
                  <span className="text-[9px] text-violet-400/80">{c.mock_label}</span>
                </div>
                <Link
                  href={`/markets/${c.market_slug}`}
                  className="text-[11px] text-zinc-400 hover:text-violet-200/90 block mt-0.5 truncate"
                >
                  {c.market_title}
                </Link>
                <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2 italic">
                  &ldquo;{c.original_take}&rdquo;
                </p>
                <p className="text-[9px] text-zinc-600 mt-1.5">
                  Verified after {c.days_early}d · +{c.reputation_delta} rep ·{" "}
                  {Math.round(c.consensus_at_time)}% → {Math.round(c.final_consensus)}% migration
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
