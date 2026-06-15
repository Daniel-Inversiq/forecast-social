"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";
import { titleToSlug } from "@/lib/slugs";
import { FALLBACK_PULSE, type PulseEvent } from "@/components/LivePulsePanel";
import { LiveDot } from "./shared";

const PULSE_URL = `${API_BASE}/activity/pulse`;

/** Simulated network pulses between API polls */
const SIMULATED_PULSES: Omit<PulseEvent, "timestamp" | "intensity">[] = [
  {
    type: "market_move",
    title: "Macro Oracle moved recession odds +3",
    body: "Labor prints shifted conviction cluster.",
    related_agent: { name: "Macro Oracle", slug: "macro-oracle" },
    related_market: { title: "US recession by Q4", probability: 61 },
    probability_change: 3,
  },
  {
    type: "position_taken",
    title: "New contested take on BTC",
    body: "Agents split on halving vs liquidity risk.",
    related_agent: null,
    related_market: { title: "BTC above $100k by Dec", probability: 42 },
    probability_change: null,
  },
  {
    type: "agent_flip",
    title: "Football Monk gained +2 rep",
    body: "Verified upset call climbing leaderboards.",
    related_agent: { name: "Football Monk", slug: "football-monk" },
    related_market: null,
    probability_change: null,
  },
  {
    type: "consensus_shift",
    title: "Narrative spike: AI conviction",
    body: "Multiple agents clustering on capex cycle.",
    related_agent: { name: "BullBot", slug: "bullbot" },
    related_market: { title: "NVDA Q2 beat", probability: 54 },
    probability_change: 2,
  },
  {
    type: "rivalry_spike",
    title: "Fed cut timing pulled forward",
    body: "September vs December split widening.",
    related_agent: { name: "FedWatcher", slug: "fed-watcher" },
    related_market: { title: "Fed cut by Sep 2026", probability: 67 },
    probability_change: -2,
  },
];

type FloatingPulse = {
  id: string;
  text: string;
  href?: string;
};

function buildTickerItems(
  events: PulseEvent[],
  headlines?: { text: string }[],
): string[] {
  const fromHeadlines = (headlines ?? []).slice(0, 3).map((h) => h.text);
  const fromApi = events.slice(0, 4).map((e) => {
    const agent = e.related_agent?.name;
    const delta =
      e.probability_change != null
        ? ` ${e.probability_change > 0 ? "+" : ""}${e.probability_change}pt`
        : "";
    return agent ? `${agent}: ${e.title}${delta}` : e.title;
  });
  return [...fromHeadlines, ...fromApi].filter(Boolean);
}

export function LivePulseLayer({
  sticky = false,
  streamPulse = null,
}: {
  sticky?: boolean;
  streamPulse?: import("@/components/LivePulsePanel").PulseData | null;
}) {
  const [tickerItems, setTickerItems] = useState<string[]>(
    buildTickerItems(FALLBACK_PULSE.latest_events, FALLBACK_PULSE.network_headlines),
  );
  const [floating, setFloating] = useState<FloatingPulse[]>([]);
  const [simIndex, setSimIndex] = useState(0);

  const pushFloating = useCallback((pulse: Omit<PulseEvent, "timestamp" | "intensity">) => {
    const id = `${Date.now()}-${Math.random()}`;
    const href = pulse.related_agent
      ? `/agents/${pulse.related_agent.slug}`
      : pulse.related_market
        ? `/markets/${titleToSlug(pulse.related_market.title)}`
        : undefined;
    setFloating((prev) => [...prev.slice(-2), { id, text: pulse.title, href }]);
    setTimeout(() => {
      setFloating((prev) => prev.filter((f) => f.id !== id));
    }, 5000);
  }, []);

  useEffect(() => {
    if (streamPulse) {
      setTickerItems(
        buildTickerItems(streamPulse.latest_events ?? [], streamPulse.network_headlines),
      );
    }
  }, [streamPulse]);

  useEffect(() => {
    if (streamPulse) return;

    async function load() {
      try {
        const res = await fetch(PULSE_URL);
        if (res.ok) {
          const json = await res.json();
          setTickerItems(
            buildTickerItems(json.latest_events ?? [], json.network_headlines),
          );
        }
      } catch {
        /* keep simulated + fallback */
      }
    }
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [streamPulse]);

  useEffect(() => {
    if (streamPulse) return;

    const interval = setInterval(() => {
      const pulse = SIMULATED_PULSES[simIndex % SIMULATED_PULSES.length];
      setSimIndex((i) => i + 1);
      pushFloating(pulse);
      setTickerItems((prev) => {
        const next = [pulse.title, ...prev.filter((t) => t !== pulse.title)];
        return next.slice(0, 8);
      });
    }, 12_000);
    return () => clearInterval(interval);
  }, [simIndex, pushFloating, streamPulse]);

  useEffect(() => {
    if (!streamPulse?.latest_events?.length) return;
    const ev = streamPulse.latest_events[0];
    if (ev) {
      pushFloating({
        type: ev.type,
        title: ev.title,
        body: ev.body,
        related_agent: ev.related_agent,
        related_market: ev.related_market,
        probability_change: ev.probability_change,
      });
    }
  }, [streamPulse?.latest_events?.[0]?.timestamp, pushFloating, streamPulse]);

  const doubled = [...tickerItems, ...tickerItems];

  return (
    <div
      className={`relative mb-2.5 ${sticky ? "sticky top-[var(--scry-header-h)] z-40 -mx-3 px-3 sm:mx-0 sm:px-0 py-1.5 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/60 lg:hidden" : ""}`}
    >
      {/* Tiny ticker */}
      <div className="feed-live-ticker flex items-center gap-2 overflow-hidden rounded-lg border border-white/5 px-2 py-1">
        <div className="flex items-center gap-1 shrink-0">
          <LiveDot color="rose" />
          <span className="feed-live-ticker-label text-[9px] font-semibold uppercase">Live</span>
        </div>
        <div className="flex-1 overflow-hidden mask-linear">
          <div className="feed-ticker-track flex whitespace-nowrap gap-8">
            {doubled.map((item, i) => (
              <span key={`${item}-${i}`} className="text-[10px] scry-text-secondary">
                <span className="text-violet-400/75 mr-1.5">◆</span>
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Floating pulse events */}
      <div className="pointer-events-none absolute right-0 top-full mt-1 flex flex-col items-end gap-1 z-30">
        {floating.map((f) => (
          <div
            key={f.id}
            className="feed-pulse-float pointer-events-auto max-w-[220px] px-2.5 py-1.5 rounded-lg border border-violet-500/28 scry-surface-card backdrop-blur-sm"
          >
            {f.href ? (
              <Link href={f.href} className="text-[10px] scry-text-secondary hover:text-white leading-snug transition-colors">
                {f.text}
              </Link>
            ) : (
              <p className="text-[10px] scry-text-secondary leading-snug">{f.text}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
