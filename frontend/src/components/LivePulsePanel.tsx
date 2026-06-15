"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { resolveBetaLiveCount, useBetaActiveNow } from "@/lib/betaActiveNow";
import { API_BASE } from "@/lib/api";
import { formatRelativeTime } from "@/lib/relativeTime";
import { useRelativeTimeTick } from "@/hooks/useRelativeTimeTick";
import { AnimatedCounter } from "@/components/feed/AnimatedCounter";
import { titleToSlug } from "@/lib/slugs";

const PULSE_URL = `${API_BASE}/activity/pulse`;
const POLL_MS = 60_000;

export type PulseAgentRef = { name: string; slug: string };
export type PulseMarketRef = { title: string; probability?: number };

export type PulseEvent = {
  type: string;
  title: string;
  body: string;
  timestamp: string;
  intensity: number;
  related_agent: PulseAgentRef | null;
  related_market: PulseMarketRef | null;
  probability_change: number | null;
};

export type NetworkHeadline = {
  type: string;
  text: string;
  intensity: number;
  momentum?: string;
  narrative_id?: string;
};

export type PulseData = {
  live_count: number;
  latest_events: PulseEvent[];
  agent_flips: PulseEvent[];
  market_moves: PulseEvent[];
  new_receipts: PulseEvent[];
  position_activity: PulseEvent[];
  network_headlines?: NetworkHeadline[];
  narrative_labels?: string[];
};

const TYPE_LABELS: Record<string, string> = {
  agent_flip: "Agent flip",
  market_move: "Market move",
  receipt_verified: "Receipt",
  position_taken: "Position",
  consensus_shift: "Consensus",
  rivalry_spike: "Rivalry",
};

const TYPE_TONE: Record<string, string> = {
  agent_flip: "text-violet-300/90 bg-violet-500/8 border-violet-500/20",
  market_move: "text-sky-300/90 bg-sky-500/8 border-sky-500/20",
  receipt_verified: "text-emerald-300/90 bg-emerald-500/8 border-emerald-500/20",
  position_taken: "text-zinc-300/90 bg-zinc-500/8 border-zinc-600/25",
  consensus_shift: "text-cyan-300/90 bg-cyan-500/8 border-cyan-500/20",
  rivalry_spike: "text-rose-300/90 bg-rose-500/8 border-rose-500/20",
};

export const FALLBACK_PULSE: PulseData = {
  live_count: resolveBetaLiveCount(),
  latest_events: [
    {
      type: "market_move",
      title: "Recession odds moved sharply",
      body: "Citing soft labor prints and credit tightening.",
      timestamp: new Date(Date.now() - 4 * 60_000).toISOString(),
      intensity: 4,
      related_agent: { name: "Macro Oracle", slug: "macro-oracle" },
      related_market: { title: "US recession by Q4", probability: 61 },
      probability_change: 6,
    },
    {
      type: "receipt_verified",
      title: "Upset called weeks before kickoff",
      body: "Posted at 12% implied when consensus had the favorite at 78%.",
      timestamp: new Date(Date.now() - 11 * 60_000).toISOString(),
      intensity: 5,
      related_agent: { name: "Football Monk", slug: "football-monk" },
      related_market: { title: "Champions League final upset", probability: 18 },
      probability_change: null,
    },
    {
      type: "rivalry_spike",
      title: "Split on NVIDIA earnings beat",
      body: "Spread widening as agents dig in on margin vs inventory risk.",
      timestamp: new Date(Date.now() - 18 * 60_000).toISOString(),
      intensity: 4,
      related_agent: { name: "BullBot", slug: "bullbot" },
      related_market: { title: "NVDA Q2 beat", probability: 54 },
      probability_change: null,
    },
    {
      type: "consensus_shift",
      title: "Fed cut timing pulled forward",
      body: "Multiple agents now cluster on September vs. December.",
      timestamp: new Date(Date.now() - 26 * 60_000).toISOString(),
      intensity: 4,
      related_agent: { name: "FedWatcher", slug: "fed-watcher" },
      related_market: { title: "Fed cut by Sep 2026", probability: 67 },
      probability_change: 3,
    },
    {
      type: "agent_flip",
      title: "ContrCap entered top 10 on climate",
      body: "Six-week streak of calibrated calls on EU carbon policy.",
      timestamp: new Date(Date.now() - 34 * 60_000).toISOString(),
      intensity: 3,
      related_agent: { name: "ContrCap", slug: "contr-cap" },
      related_market: { title: "EU carbon policy shift", probability: 55 },
      probability_change: null,
    },
  ],
  agent_flips: [],
  market_moves: [],
  new_receipts: [
    {
      type: "receipt_verified",
      title: "NVDA beats earnings verified",
      body: "Beat thesis locked — +14 credibility on receipt.",
      timestamp: new Date(Date.now() - 9 * 60_000).toISOString(),
      intensity: 5,
      related_agent: { name: "BullBot", slug: "bullbot" },
      related_market: { title: "NVDA beats earnings", probability: 72 },
      probability_change: null,
    },
    {
      type: "receipt_verified",
      title: "Fed cuts before June — wrong",
      body: "June window closed — −11 credibility on miss.",
      timestamp: new Date(Date.now() - 21 * 60_000).toISOString(),
      intensity: 4,
      related_agent: { name: "Macro Oracle", slug: "macro-oracle" },
      related_market: { title: "Fed cuts before June", probability: 18 },
      probability_change: null,
    },
    {
      type: "receipt_verified",
      title: "Oil above $100 verified",
      body: "Supply shock call archived — +9 credibility.",
      timestamp: new Date(Date.now() - 33 * 60_000).toISOString(),
      intensity: 4,
      related_agent: { name: "FedWatcher", slug: "fed-watcher" },
      related_market: { title: "Oil above $100", probability: 61 },
      probability_change: null,
    },
  ],
  position_activity: [],
};

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}

function IntensityDots({ level }: { level: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`Intensity ${level}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`h-1 w-1 rounded-full ${
            i <= level ? "bg-violet-400/70" : "bg-zinc-700"
          }`}
        />
      ))}
    </span>
  );
}

function ProbMove({ delta }: { delta: number }) {
  const up = delta > 0;
  return (
    <span
      className={`text-[10px] font-semibold tabular-nums ${
        up ? "text-emerald-400/90" : "text-rose-400/90"
      }`}
    >
      {up ? "+" : ""}
      {delta.toFixed(1)} pts
    </span>
  );
}

function PulseEventRow({ event }: { event: PulseEvent }) {
  useRelativeTimeTick();
  const tone = TYPE_TONE[event.type] ?? TYPE_TONE.position_taken;
  const agent = event.related_agent;
  const market = event.related_market;

  return (
    <li className="group relative pl-3 border-l border-zinc-800/80 hover:border-violet-500/30 transition-colors feed-fade-in">
      <div className="absolute -left-[3px] top-2 h-1.5 w-1.5 rounded-full bg-zinc-700 group-hover:bg-violet-500/60 transition-colors" />
      <div className="flex items-start justify-between gap-2 mb-0.5">
        <span
          className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${tone}`}
        >
          {typeLabel(event.type)}
        </span>
        <span className="text-[10px] scry-text-tertiary tabular-nums shrink-0">
          {formatRelativeTime(event.timestamp, true)}
        </span>
      </div>
      <p className="text-xs font-medium scry-text-primary leading-snug line-clamp-2">{event.title}</p>
      <p className="text-[11px] scry-text-secondary mt-1 line-clamp-1">{event.body}</p>
      <div className="flex items-center justify-between gap-2 mt-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {agent && (
            <Link
              href={`/agents/${agent.slug}`}
              className="text-[10px] text-violet-400/80 hover:text-violet-300 truncate"
            >
              {agent.name}
            </Link>
          )}
          {market && (
            <Link
              href={`/markets/${titleToSlug(market.title)}`}
              className="text-[10px] text-zinc-500 hover:text-zinc-400 truncate"
            >
              {market.title}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {event.probability_change != null && (
            <ProbMove delta={event.probability_change} />
          )}
          <IntensityDots level={event.intensity} />
        </div>
      </div>
    </li>
  );
}

export function LivePulsePanel({
  className = "",
  compact = false,
  streamPulse = null,
  streamConnected = false,
  hideWhenUnavailable = false,
}: {
  className?: string;
  compact?: boolean;
  streamPulse?: PulseData | null;
  streamConnected?: boolean;
  /** Omit panel when API is offline, still loading, or there are no live events. */
  hideWhenUnavailable?: boolean;
}) {
  const [data, setData] = useState<PulseData | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (streamPulse) {
      setData(streamPulse);
      setUsingFallback(false);
      setLoading(false);
    }
  }, [streamPulse]);

  useEffect(() => {
    if (streamConnected) return;

    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(PULSE_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as PulseData;
        if (!cancelled) {
          setData(json);
          setUsingFallback(false);
        }
      } catch {
        if (!cancelled) {
          setData(FALLBACK_PULSE);
          setUsingFallback(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [streamConnected]);

  const pulse = streamPulse ?? data ?? FALLBACK_PULSE;
  const liveActive = useBetaActiveNow(pulse.live_count);
  const events = pulse.latest_events.slice(0, 5);
  const unavailable =
    hideWhenUnavailable &&
    (loading || usingFallback || events.length === 0);

  if (unavailable) {
    return null;
  }

  return (
    <section
      className={`rounded-2xl border border-zinc-800/90 bg-zinc-950/70 overflow-hidden ${className}`}
    >
      <div className="px-4 pt-4 pb-3.5 border-b border-zinc-800/60 bg-gradient-to-br from-zinc-950 via-violet-950/12 to-zinc-950">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400/30" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500/70 animate-pulse" />
            </span>
            <h3 className="text-sm font-semibold scry-text-primary tracking-tight">Live Pulse</h3>
          </div>
          <span className="text-[9px] font-medium text-violet-300/65 border border-violet-500/20 bg-violet-500/5 px-2 py-0.5 rounded-full">
            Live
          </span>
        </div>
        <div className="flex items-baseline justify-between mt-2.5">
          <p className="text-[11px] scry-text-tertiary">
            Activity stream · {streamConnected ? "live" : "sync"}
          </p>
          <p className="text-lg font-semibold scry-text-primary tabular-nums">
            {loading ? "—" : <AnimatedCounter value={liveActive} />}
            <span className="text-[10px] font-normal scry-text-tertiary ml-1">active</span>
          </p>
        </div>
        {usingFallback && !loading && (
          <p className="text-[10px] text-zinc-600 mt-1">Offline pulse — cached stream</p>
        )}
      </div>

      <div className={`${compact ? "p-3" : "p-3.5"}`}>
        {loading ? (
          <p className="text-xs text-zinc-500 animate-pulse py-5 text-center">Listening…</p>
        ) : events.length === 0 ? (
          <p className="text-xs text-zinc-500 py-5 text-center">Quiet for now.</p>
        ) : (
          <ul className="space-y-3.5">
            {events.map((ev) => (
              <PulseEventRow key={`${ev.type}-${ev.timestamp}-${ev.title}`} event={ev} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
