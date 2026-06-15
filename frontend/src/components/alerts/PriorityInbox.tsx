"use client";

import { useState } from "react";
import {
  groupAlertsBySection,
  PRIORITY_SECTION_ORDER,
  sectionMeta,
} from "./alertIntelligence";
import { ActivityCard } from "./ActivityStream";
import type { EnrichedAlert } from "./types";

export function PriorityInbox({
  alerts,
  loading,
  newDividerId,
}: {
  alerts: EnrichedAlert[];
  loading: boolean;
  newDividerId?: string | null;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const groups = groupAlertsBySection(alerts);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <div className="h-4 w-32 bg-zinc-800/60 rounded animate-pulse mb-2" />
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((__, j) => (
                <div
                  key={j}
                  className="h-28 rounded-xl border border-zinc-800/60 bg-zinc-900/40 animate-pulse"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const total = alerts.length;
  if (total === 0) {
    return (
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-8 sm:p-10 text-center">
        <p className="text-base font-medium text-zinc-300">Quiet for now.</p>
        <p className="text-[11px] text-zinc-500 mt-2 max-w-sm mx-auto leading-relaxed">
          Your positions are stable. Network pulse is calm — check back when conviction reprices or a
          followed agent moves.
        </p>
      </div>
    );
  }

  let shownNewDivider = false;

  return (
    <div className="space-y-5">
      {PRIORITY_SECTION_ORDER.map((section) => {
        const items = groups[section];
        if (items.length === 0) return null;
        const meta = sectionMeta(section);
        const isCollapsed = collapsed[section] ?? false;

        return (
          <section key={section} className="min-w-0">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
                  return;
                }
                setCollapsed((c) => ({ ...c, [section]: !isCollapsed }));
              }}
              className="w-full flex items-center gap-2 mb-2 px-0.5 group text-left"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 group-hover:text-zinc-200 transition">
                {meta.title}
              </span>
              <span className="text-[9px] text-zinc-600 hidden sm:inline">{meta.subtitle}</span>
              <span className="text-[9px] text-violet-400/80 tabular-nums ml-auto shrink-0">
                {items.length}
              </span>
              <span className="lg:hidden text-zinc-600 text-[10px]">{isCollapsed ? "▸" : "▾"}</span>
              <span className="hidden lg:block h-px flex-1 bg-gradient-to-r from-zinc-800 to-transparent min-w-[2rem]" />
            </button>

            {!isCollapsed && (
              <ul className="space-y-2.5 min-w-0">
                {items.map((alert) => {
                  const showDivider =
                    !shownNewDivider &&
                    newDividerId &&
                    alert.id === newDividerId &&
                    alert.isStreamed;
                  if (showDivider) shownNewDivider = true;

                  return (
                    <li key={alert.id} className="min-w-0">
                      {showDivider && (
                        <div className="flex items-center gap-2 py-2 mb-1">
                          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
                          <span className="text-[9px] uppercase tracking-wider text-violet-300/90 attention-new-divider">
                            New alerts
                          </span>
                          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
                        </div>
                      )}
                      <ActivityCard alert={alert} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
