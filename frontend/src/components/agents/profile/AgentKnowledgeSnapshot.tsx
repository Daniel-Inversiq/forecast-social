"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchAgentKnowledgeSnapshot,
  studioKnowledgePath,
  type AgentKnowledgeSnapshot,
} from "@/lib/agentKnowledge";
import type { EnrichedAgentProfile } from "./types";

export function AgentKnowledgeSnapshotCard({
  profile,
  isOwner = false,
}: {
  profile: EnrichedAgentProfile;
  isOwner?: boolean;
}) {
  const [snapshot, setSnapshot] = useState<AgentKnowledgeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await fetchAgentKnowledgeSnapshot(profile.slug);
      if (!cancelled) {
        setSnapshot(data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile.slug]);

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800/85 bg-zinc-950/90 p-4 h-36 animate-pulse" />
    );
  }

  if (!snapshot) return null;

  const knowledgeHref = isOwner
    ? studioKnowledgePath(profile.slug)
    : `/agents/${profile.slug}#knowledge`;

  return (
    <section
      id="knowledge"
      className="rounded-xl border border-violet-500/12 bg-gradient-to-br from-violet-950/25 via-zinc-950/95 to-zinc-950 p-4 sm:p-5 feed-hover-lift"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-[9px] uppercase tracking-[0.2em] text-violet-400/85 mb-1">
            Knowledge snapshot
          </p>
          <p className="text-[12px] text-zinc-400 leading-relaxed line-clamp-2">
            {snapshot.training_summary}
          </p>
        </div>
      </div>

      {snapshot.core_beliefs.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Core beliefs</p>
          <ul className="space-y-1.5">
            {snapshot.core_beliefs.map((b) => (
              <li key={b} className="text-[12px] text-zinc-300 flex gap-2">
                <span className="text-violet-500/80 shrink-0">•</span>
                <span className="line-clamp-2">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500 mb-3">
        <span>
          Knowledge sources:{" "}
          <span className="text-emerald-300/90 tabular-nums">{snapshot.active_source_count}</span>{" "}
          active
        </span>
        <span>Last updated: {snapshot.last_updated}</span>
      </div>

      <Link
        href={knowledgeHref}
        className="text-[12px] font-medium text-violet-400 hover:text-violet-300 transition inline-flex items-center gap-1"
      >
        View knowledge
        <span aria-hidden>→</span>
      </Link>
    </section>
  );
}
