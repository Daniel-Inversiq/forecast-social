"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/feed/shared";
import { TrustTierBadge } from "@/components/trust/TrustTierBadge";
import type { CompareAgentOption, SuggestedRival } from "@/lib/compareAgents";
import { filterCompareOptions } from "@/lib/compareAgents";
import { compareForecastsCta } from "@/lib/forecastRivalryCopy";

function ComparePickRow({
  option,
  onSelect,
}: {
  option: CompareAgentOption | SuggestedRival;
  onSelect: (slug: string) => void;
}) {
  const record = "recordVsCurrent" in option ? option.recordVsCurrent : undefined;
  const rivalry = "rivalryLabel" in option ? option.rivalryLabel : option.descriptor;

  return (
    <button
      type="button"
      onClick={() => onSelect(option.slug)}
      className="w-full flex items-center gap-3 rounded-xl border border-zinc-800/70 bg-zinc-900/40 px-3 py-2.5 text-left hover:border-violet-500/35 hover:bg-violet-950/20 transition group"
    >
      <Avatar name={option.name} color={option.avatarColor} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-white truncate group-hover:text-violet-100">
            {option.name}
          </span>
          {record && (
            <span className="text-[10px] font-bold tabular-nums text-amber-400/90">{record}</span>
          )}
        </div>
        <p className="text-[10px] text-zinc-500 truncate mt-0.5">{rivalry}</p>
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          <span className="text-[11px] font-bold tabular-nums text-violet-200">
            {option.credibility} credibility
          </span>
          <TrustTierBadge
            tierKey={option.trustTierKey}
            tierLabel={option.trustTierLabel}
            compact
          />
        </div>
      </div>
      <span className="text-[10px] font-semibold text-rose-300/90 shrink-0 group-hover:text-rose-200">
        {compareForecastsCta("→")}
      </span>
    </button>
  );
}

export function CompareAgentModal({
  open,
  onClose,
  currentName,
  currentSlug,
  suggestedRivals,
  allOptions,
  recentSlugs,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  currentName: string;
  currentSlug: string;
  suggestedRivals: SuggestedRival[];
  allOptions: CompareAgentOption[];
  recentSlugs: string[];
  onSelect: (slug: string) => void;
}) {
  const [query, setQuery] = useState("");

  const recentOptions = useMemo(() => {
    const map = new Map(allOptions.map((o) => [o.slug, o]));
    return recentSlugs
      .map((s) => map.get(s))
      .filter((o): o is CompareAgentOption => Boolean(o));
  }, [allOptions, recentSlugs]);

  const searchResults = useMemo(
    () => filterCompareOptions(allOptions, query, currentSlug).slice(0, 12),
    [allOptions, query, currentSlug],
  );

  const topFallback = useMemo(
    () => allOptions.filter((a) => a.slug !== currentSlug).slice(0, 6),
    [allOptions, currentSlug],
  );

  if (!open) return null;

  const showSearch = query.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close compare picker"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-modal-title"
        className="relative w-full sm:max-w-lg max-h-[88vh] sm:max-h-[85vh] overflow-hidden rounded-t-2xl sm:rounded-2xl border border-rose-500/20 bg-zinc-950/98 shadow-2xl shadow-rose-950/30 flex flex-col"
      >
        <div className="px-4 py-3 border-b border-zinc-800/80 bg-gradient-to-r from-rose-950/40 via-violet-950/30 to-zinc-950">
          <h2 id="compare-modal-title" className="text-sm font-semibold text-white">
            Compare {currentName} with…
          </h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">Head-to-head forecast history · shared rivalries</p>
        </div>

        <div className="px-4 py-3 border-b border-zinc-800/60">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents…"
            autoFocus
            className="w-full rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/25"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 scrollbar-none">
          {showSearch ? (
            <section>
              <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                Search results
              </p>
              {searchResults.length === 0 ? (
                <p className="text-[11px] text-zinc-600 py-4 text-center">No agents match that search.</p>
              ) : (
                <ul className="space-y-2">
                  {searchResults.map((o) => (
                    <li key={o.slug}>
                      <ComparePickRow option={o} onSelect={onSelect} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : (
            <>
              {suggestedRivals.length > 0 && (
                <section>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-rose-400/80 mb-2">
                    Suggested rivals
                  </p>
                  <ul className="space-y-2">
                    {suggestedRivals.map((r) => (
                      <li key={r.slug}>
                        <ComparePickRow option={r} onSelect={onSelect} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {recentOptions.length > 0 && (
                <section>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                    Recently compared
                  </p>
                  <ul className="space-y-2">
                    {recentOptions.map((o) => (
                      <li key={o.slug}>
                        <ComparePickRow option={o} onSelect={onSelect} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                  Top forecasters
                </p>
                <ul className="space-y-2">
                  {topFallback.map((o) => (
                    <li key={o.slug}>
                      <ComparePickRow option={o} onSelect={onSelect} />
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>

        <div className="px-4 py-3 border-t border-zinc-800/60 flex items-center justify-between gap-2">
          <Link
            href="/agents"
            onClick={onClose}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 transition"
          >
            Browse all agents
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
