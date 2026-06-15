"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchRelated, SEARCH_TYPE_ACCENT, SEARCH_TYPE_LABELS, type RelatedResponse } from "@/lib/search";

type EntityType = "market" | "agent" | "season" | "battle";

const FALLBACK_RELATED: Record<EntityType, RelatedResponse> = {
  market: {
    headline: "Related intelligence",
    sections: [
      {
        label: "Active battles",
        items: [
          {
            title: "FedWatcher vs DoomBot",
            summary: "Disagreement intensifying on this thread",
            href: "/battles/fed-watcher-vs-doombot",
            type: "battle",
          },
        ],
      },
      {
        label: "Signals",
        items: [
          {
            title: "Macro fragmentation signal",
            summary: "Consensus spread widening",
            href: "/narratives",
            type: "signal",
          },
        ],
      },
      {
        label: "Verified calls",
        items: [
          {
            title: "Early call sealed",
            summary: "Before crowd repriced",
            href: "/verified-calls",
            type: "verified_call",
          },
        ],
      },
    ],
  },
  agent: {
    headline: "Network connections",
    sections: [
      {
        label: "Battles",
        items: [
          {
            title: "Active rivalry",
            summary: "Reputational stakes rising",
            href: "/battles",
            type: "battle",
          },
        ],
      },
      {
        label: "Signals",
        items: [
          {
            title: "Niche fragmentation",
            summary: "Timing edge forming",
            href: "/narratives",
            type: "signal",
          },
        ],
      },
    ],
  },
  season: {
    headline: "Era intelligence",
    sections: [
      {
        label: "Defining markets",
        items: [
          {
            title: "Fed cut by Sep 2026",
            summary: "Era thread · macro pressure",
            href: "/markets/fed-cut-by-sep-2026",
            type: "market",
          },
        ],
      },
      {
        label: "Consensus failures",
        items: [
          {
            title: "Regime fragmentation event",
            summary: "Desk unified late — agents moved first",
            href: "/narratives",
            type: "signal",
          },
        ],
      },
    ],
  },
  battle: {
    headline: "Battle intelligence",
    sections: [],
  },
};

export function RelatedIntelligence({
  entityType,
  entityId,
  className = "",
}: {
  entityType: EntityType;
  entityId: string;
  className?: string;
}) {
  const [data, setData] = useState<RelatedResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetchRelated(entityType, entityId);
      if (!cancelled) {
        setData(res ?? FALLBACK_RELATED[entityType]);
      }
    }
    if (entityId) load();
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  if (!data?.sections.length) return null;

  return (
    <section
      className={`rounded-xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden ${className}`}
    >
      <header className="px-3 py-2.5 border-b border-zinc-800/60 bg-zinc-950/50">
        <p className="text-[9px] uppercase tracking-[0.16em] text-zinc-500 font-semibold">
          Related intelligence
        </p>
        <p className="text-[10px] text-zinc-600 mt-0.5 font-mono truncate">{data.headline}</p>
      </header>
      <div className="divide-y divide-zinc-800/50">
        {data.sections.map((section) => (
          <div key={section.label} className="p-2.5">
            <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-1.5">{section.label}</p>
            <ul className="space-y-1">
              {section.items.map((item) => (
                <li key={item.href + item.title}>
                  <Link
                    href={item.href}
                    className="block px-2 py-1.5 rounded-lg hover:bg-zinc-800/50 transition group"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`shrink-0 text-[7px] uppercase tracking-wider px-1 py-0.5 rounded border ${
                          SEARCH_TYPE_ACCENT[item.type] ?? SEARCH_TYPE_ACCENT.agent
                        }`}
                      >
                        {SEARCH_TYPE_LABELS[item.type] ?? item.type}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] text-zinc-300 group-hover:text-zinc-100 truncate">
                          {item.title}
                        </p>
                        <p className="text-[9px] text-zinc-600 leading-snug line-clamp-2">
                          {item.summary}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
