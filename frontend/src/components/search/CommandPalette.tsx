"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchSearch,
  SEARCH_TYPE_ACCENT,
  SEARCH_TYPE_LABELS,
  type SearchResult,
  type SearchResponse,
} from "@/lib/search";
import { FALLBACK_SEARCH_IDLE } from "./fallbackData";

const RECENT_KEY = "scry_recent_discoveries";
const CATEGORY_ORDER = [
  "agent",
  "market",
  "signal",
  "battle",
  "verified_call",
  "season",
  "ranking",
  "position",
  "feed_event",
];

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(href: string, title: string) {
  const entry = `${title}::${href}`;
  const prev = loadRecent().filter((r) => r !== entry);
  const next = [entry, ...prev].slice(0, 6);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

function groupResults(results: SearchResult[]) {
  const groups = new Map<string, SearchResult[]>();
  for (const r of results) {
    const list = groups.get(r.type) ?? [];
    list.push(r);
    groups.set(r.type, list);
  }
  const ordered: { type: string; items: SearchResult[] }[] = [];
  for (const type of CATEGORY_ORDER) {
    const items = groups.get(type);
    if (items?.length) ordered.push({ type, items });
  }
  for (const [type, items] of groups) {
    if (!CATEGORY_ORDER.includes(type)) ordered.push({ type, items });
  }
  return ordered;
}

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);

  const flatResults = useMemo(() => data?.results ?? [], [data]);
  const grouped = useMemo(() => groupResults(flatResults), [flatResults]);

  useEffect(() => {
    if (open) {
      setRecent(loadRecent());
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const res = await fetchSearch(query.trim());
      if (!cancelled) {
        setData(res ?? FALLBACK_SEARCH_IDLE);
        setActiveIndex(0);
        setLoading(false);
      }
    }, query.trim() ? 180 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open]);

  const navigate = useCallback(
    (result: SearchResult) => {
      saveRecent(result.href, result.title);
      onClose();
      router.push(result.href);
    },
    [onClose, router],
  );

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, Math.max(0, flatResults.length - 1)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && flatResults[activeIndex]) {
        e.preventDefault();
        navigate(flatResults[activeIndex]);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, flatResults, activeIndex, navigate]);

  if (!open) return null;

  const idle = !query.trim();
  const trending = data?.trending_discoveries ?? FALLBACK_SEARCH_IDLE.trending_discoveries;
  const relatedQueries = data?.related_queries ?? [];

  let rowOffset = 0;

  return (
    <div className="scry-palette-root fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-3 sm:px-4 scry-palette-mobile-full">
      <button
        type="button"
        className="scry-backdrop-dismiss absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close search"
        onClick={onClose}
      />
      <div
        className="scry-palette-panel scry-palette-mobile-panel relative w-full max-w-xl rounded-xl border border-zinc-800/90 bg-zinc-950/98 shadow-2xl shadow-violet-950/30 overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Universal search"
      >
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-800/80 bg-zinc-900/40">
          <svg className="w-4 h-4 text-violet-500/80 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Navigate the intelligence graph…"
            className="flex-1 bg-transparent text-base sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none font-mono min-h-[44px] sm:min-h-0"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline text-[9px] text-zinc-600 border border-zinc-800 px-1.5 py-0.5 rounded font-mono">
            esc
          </kbd>
        </div>

        <div className="flex-1 max-h-[min(60vh,520px)] sm:max-h-[min(60vh,520px)] max-sm:max-h-none overflow-y-auto scry-palette-scroll">
          {loading && query.trim() && (
            <p className="px-3 py-2 text-[10px] text-zinc-600 font-mono">Scanning graph…</p>
          )}

          {idle && (
            <div className="p-2 space-y-3">
              <PaletteSection title="Intelligence map">
                <Link
                  href="/discover"
                  onClick={onClose}
                  className="flex items-center justify-between px-2.5 py-2 rounded-lg border border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10 transition group"
                >
                  <span className="text-[11px] text-violet-300/90 group-hover:text-violet-200">
                    Open discovery layer
                  </span>
                  <span className="text-[10px] text-zinc-600 font-mono">/discover</span>
                </Link>
              </PaletteSection>

              {recent.length > 0 && (
                <PaletteSection title="Recent discoveries">
                  {recent.map((entry) => {
                    const [title, href] = entry.split("::");
                    return (
                      <PaletteRow
                        key={entry}
                        title={title}
                        summary={href}
                        typeLabel="Recent"
                        accent="text-zinc-500 border-zinc-700/50 bg-zinc-800/30"
                        onSelect={() => {
                          onClose();
                          router.push(href);
                        }}
                      />
                    );
                  })}
                </PaletteSection>
              )}

              <PaletteSection title="Trending searches">
                <div className="flex flex-wrap gap-1.5 px-1">
                  {(data?.related_queries ?? FALLBACK_SEARCH_IDLE.related_queries).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuery(q)}
                      className="text-[10px] px-2 py-1 rounded-full border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition font-mono"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </PaletteSection>

              <PaletteSection title="Active intelligence">
                {trending.map((t) => (
                  <PaletteRow
                    key={t.href + t.title}
                    title={t.title}
                    summary={t.summary}
                    typeLabel={SEARCH_TYPE_LABELS[t.type] ?? t.type}
                    accent={SEARCH_TYPE_ACCENT[t.type] ?? SEARCH_TYPE_ACCENT.agent}
                    onSelect={() => {
                      onClose();
                      router.push(t.href);
                    }}
                  />
                ))}
              </PaletteSection>

              <PaletteSection title="Rising signals">
                {(data?.results ?? FALLBACK_SEARCH_IDLE.results)
                  .filter((r) => r.type === "signal" || r.type === "battle")
                  .slice(0, 4)
                  .map((r, i) => (
                    <PaletteRow
                      key={r.href + i}
                      title={r.title}
                      summary={r.summary}
                      typeLabel={SEARCH_TYPE_LABELS[r.type]}
                      accent={SEARCH_TYPE_ACCENT[r.type]}
                      onSelect={() => navigate(r)}
                    />
                  ))}
              </PaletteSection>
            </div>
          )}

          {!idle && flatResults.length === 0 && !loading && (
            <p className="px-3 py-6 text-center text-[11px] text-zinc-600 font-mono">
              No intelligence matches — try a narrative or agent name
            </p>
          )}

          {!idle &&
            grouped.map(({ type, items }) => (
              <PaletteSection key={type} title={SEARCH_TYPE_LABELS[type] ?? type}>
                {items.map((result) => {
                  const idx = rowOffset++;
                  const active = idx === activeIndex;
                  return (
                    <PaletteRow
                      key={`${result.href}-${result.title}`}
                      title={result.title}
                      subtitle={result.subtitle}
                      summary={result.summary}
                      typeLabel={SEARCH_TYPE_LABELS[result.type] ?? result.type}
                      accent={SEARCH_TYPE_ACCENT[result.type] ?? SEARCH_TYPE_ACCENT.agent}
                      active={active}
                      relatedEntity={
                        typeof result.metadata?.related_entity === "string"
                          ? result.metadata.related_entity
                          : undefined
                      }
                      onSelect={() => navigate(result)}
                    />
                  );
                })}
              </PaletteSection>
            ))}

          {!idle && relatedQueries.length > 0 && (
            <div className="px-3 py-2 border-t border-zinc-800/60">
              <p className="text-[9px] uppercase tracking-widest text-zinc-600 mb-1.5">Related</p>
              <div className="flex flex-wrap gap-1">
                {relatedQueries.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuery(q)}
                    className="text-[10px] text-zinc-500 hover:text-violet-400 font-mono"
                  >
                    {q} →
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between px-3 py-1.5 border-t border-zinc-800/60 bg-zinc-900/30 text-[9px] text-zinc-600 font-mono">
          <span>↑↓ navigate · ↵ open · esc close</span>
          <span className="text-zinc-700">⌘K</span>
        </footer>
      </div>
    </div>
  );
}

function PaletteSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] text-zinc-600 font-semibold">
        {title}
      </p>
      <div className="space-y-0.5 px-1">{children}</div>
    </div>
  );
}

function PaletteRow({
  title,
  subtitle,
  summary,
  typeLabel,
  accent,
  active,
  relatedEntity,
  onSelect,
}: {
  title: string;
  subtitle?: string;
  summary: string;
  typeLabel: string;
  accent: string;
  active?: boolean;
  relatedEntity?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left px-2.5 py-2 rounded-lg border transition ${
        active
          ? "border-violet-500/40 bg-violet-500/10"
          : "border-transparent hover:border-zinc-800 hover:bg-zinc-900/60"
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          className={`shrink-0 text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border font-semibold ${accent}`}
        >
          {typeLabel}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-zinc-200 truncate">{title}</p>
          {subtitle && <p className="text-[10px] text-zinc-600 truncate">{subtitle}</p>}
          <p className="text-[10px] text-zinc-500 leading-snug mt-0.5 line-clamp-2">{summary}</p>
          {relatedEntity && (
            <p className="text-[9px] text-violet-500/70 mt-0.5 truncate">↳ {relatedEntity}</p>
          )}
        </div>
      </div>
    </button>
  );
}
