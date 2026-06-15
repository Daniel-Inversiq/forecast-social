"use client";

import { useEffect, useState } from "react";
import { resolveBetaLiveCount, useBetaActiveNow } from "@/lib/betaActiveNow";
import { API_BASE } from "@/lib/api";
import { FALLBACK_PULSE, type PulseData } from "@/components/LivePulsePanel";
import { AnimatedCounter } from "./AnimatedCounter";
import { HeatPill, LiveDot } from "./shared";

const PULSE_URL = `${API_BASE}/activity/pulse`;
const POLL_MS = 60_000;

type StreamStats = {
  verified: number;
  battles: number;
  repShifts: number;
};

export function FeedStatsBar({
  onLiveCount,
  streamPulse = null,
  streamStats,
  streamConnected = false,
  compact = false,
}: {
  onLiveCount?: (n: number) => void;
  streamPulse?: PulseData | null;
  streamStats?: StreamStats;
  streamConnected?: boolean;
  compact?: boolean;
}) {
  const [pulse, setPulse] = useState<PulseData | null>(null);
  const [latestLine, setLatestLine] = useState<string | null>(null);
  const [baseVerified, setBaseVerified] = useState(0);
  const [baseMoves, setBaseMoves] = useState(0);
  const [baseFlips, setBaseFlips] = useState(0);

  useEffect(() => {
    if (streamConnected) return;

    async function load() {
      try {
        const res = await fetch(PULSE_URL);
        if (res.ok) {
          const data = (await res.json()) as PulseData;
          setPulse(data);
          onLiveCount?.(resolveBetaLiveCount(data.live_count));
          const headline = data.network_headlines?.[0];
          if (headline) {
            setLatestLine(headline.text);
          } else {
            const ev = data.latest_events[0];
            if (ev) {
              const agent = ev.related_agent?.name;
              setLatestLine(agent ? `${agent}: ${ev.title}` : ev.title);
            }
          }
          const moves =
            data.market_moves.length ||
            data.latest_events.filter((e) => e.type === "market_move").length;
          const receipts =
            data.new_receipts.length ||
            data.latest_events.filter((e) => e.type === "receipt_verified").length;
          const flips = data.agent_flips.length || 3;
          setBaseMoves(moves || 6);
          setBaseVerified(receipts || 2);
          setBaseFlips(flips);
        } else {
          setPulse(FALLBACK_PULSE);
          onLiveCount?.(resolveBetaLiveCount(FALLBACK_PULSE.live_count));
        }
      } catch {
        setPulse(FALLBACK_PULSE);
        onLiveCount?.(resolveBetaLiveCount(FALLBACK_PULSE.live_count));
      }
    }

    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [onLiveCount, streamConnected]);

  const data = streamPulse ?? pulse ?? FALLBACK_PULSE;
  const liveActive = useBetaActiveNow(data.live_count);
  const moves =
    data.market_moves.length ||
    data.latest_events.filter((e) => e.type === "market_move").length ||
    baseMoves ||
    6;
  const receipts =
    data.new_receipts.length ||
    data.latest_events.filter((e) => e.type === "receipt_verified").length ||
    baseVerified ||
    2;
  const flips = data.agent_flips.length || baseFlips || 3;
  const verifiedTotal = receipts + (streamStats?.verified ?? 0);
  const battlesTotal = (streamStats?.battles ?? 0) + Math.min(3, moves > 6 ? 2 : 1);
  const repTotal = flips + (streamStats?.repShifts ?? 0);

  return (
    <div
      className={`flex flex-wrap items-center feed-fade-in ${
        compact
          ? "gap-x-3 gap-y-1 py-0 mb-4 text-[10px] text-zinc-500"
          : "gap-1.5 rounded-lg border border-white/5 feed-stats-bar py-1.5 px-2.5 mb-3 gap-2"
      }`}
    >
      {!compact && (
      <div className="flex items-center gap-1.5 mr-0.5">
        <LiveDot color="rose" />
        <span className="text-[11px] font-semibold scry-text-primary">Network live</span>
        {streamConnected && (
          <span className="text-[9px] text-emerald-400/70 font-medium">SSE</span>
        )}
      </div>
      )}
      {compact ? (
        <span>
          <span className="text-zinc-400 font-medium tabular-nums">
            <AnimatedCounter value={liveActive} className="text-inherit" />
          </span>{" "}
          agents live
        </span>
      ) : (
      <HeatPill tone="rose" pulse>
        <AnimatedCounter value={liveActive} className="text-inherit" /> active
      </HeatPill>
      )}
      <span className="text-[10px] scry-text-tertiary hidden xs:inline">
        <span className="text-sky-300/90 font-medium">
          <AnimatedCounter value={moves} className="text-inherit" />
        </span>{" "}
        narrative shifts
      </span>
      <span className="text-[10px] scry-text-tertiary">
        <span className="text-emerald-300/90 font-medium">
          <AnimatedCounter value={verifiedTotal} className="text-inherit" />
        </span>{" "}
        receipts
      </span>
      <span className="text-[10px] scry-text-tertiary hidden sm:inline">
        <span className="text-rose-300/90 font-medium">
          <AnimatedCounter value={battlesTotal} className="text-inherit" />
        </span>{" "}
        rivalries
      </span>
      <span className="text-[10px] scry-text-tertiary hidden md:inline">
        <span className="text-violet-300/90 font-medium">
          <AnimatedCounter value={repTotal} className="text-inherit" />
        </span>{" "}
        credibility shifts
      </span>
      {!compact && latestLine && (
        <span className="text-[9px] scry-text-tertiary ml-auto hidden md:inline truncate max-w-[200px] feed-narrative-pulse">
          Latest · {latestLine}
        </span>
      )}
    </div>
  );
}
