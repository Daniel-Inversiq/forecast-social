"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/api";
import type { FeedEvent } from "@/components/feed/feedMix";
import { enrichFeedEvent } from "@/components/feed/feedEnrichment";
import { chipToApiParam } from "@/components/feed/feedMix";
import { feedStreamLog } from "@/lib/feedStreamMerge";
import type { PulseData } from "@/components/LivePulsePanel";

export type StreamPulse = {
  live_count?: number;
  pulse_headlines?: { type: string; text: string; intensity: number }[];
  narrative_labels?: string[];
};

export type StreamReputationMovement = {
  agent: { name: string; slug: string; niche?: string };
  reputation_delta: number;
  trend?: string;
  label?: string;
};

export type StreamBattle = {
  id: string;
  agent_a: { name: string; slug: string };
  agent_b: { name: string; slug: string };
  market_title?: string | null;
  market_slug?: string | null;
  disagreement_score: number;
  intensity: string;
  widening?: boolean;
};

type StreamHandlers = {
  onFeedEvent?: (event: FeedEvent) => void;
  onVerifiedCall?: (event: FeedEvent) => void;
  onBattle?: (battle: StreamBattle) => void;
  onReputation?: (movement: StreamReputationMovement) => void;
  onPulse?: (pulse: StreamPulse) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
};

function streamUrl(chip: string): string {
  const param = chipToApiParam(chip);
  const base = `${API_BASE}/feed/stream`;
  return param ? `${base}?chip=${encodeURIComponent(param)}` : base;
}

function parseFeedPayload(data: {
  event?: FeedEvent;
  id?: number;
  type?: string;
  created_at?: string;
  payload?: Record<string, unknown>;
  agent_slug?: string;
  market_slug?: string | null;
}): FeedEvent | null {
  if (data.event) return enrichFeedEvent(data.event);
  return null;
}

export function useFeedStream(chip: string, handlers: StreamHandlers, enabled = true) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const [connected, setConnected] = useState(false);
  const reconnectMs = useRef(3000);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let es: EventSource | null = null;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const handleFeed = (raw: MessageEvent, label: string) => {
      try {
        const data = JSON.parse(raw.data);
        feedStreamLog("event received", label, data.id ?? data.type);
        const event = parseFeedPayload(data);
        if (event) handlersRef.current.onFeedEvent?.(event);
      } catch {
        /* ignore malformed */
      }
    };

    const open = () => {
      if (cancelled) return;
      es = new EventSource(streamUrl(chip));

      es.addEventListener("connected", () => {
        setConnected(true);
        reconnectMs.current = 3000;
        feedStreamLog("SSE connected");
        handlersRef.current.onConnected?.();
      });

      es.addEventListener("feed_event", (raw) => handleFeed(raw, "feed_event"));
      es.addEventListener("verified_call", (raw) => {
        try {
          const data = JSON.parse(raw.data);
          feedStreamLog("event received", "verified_call", data.id);
          const event = parseFeedPayload(data);
          if (event) {
            handlersRef.current.onVerifiedCall?.(event);
            handlersRef.current.onFeedEvent?.(event);
          }
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("battle_escalation", (raw) => {
        try {
          const data = JSON.parse(raw.data);
          feedStreamLog("event received", "battle_escalation", data.id);
          if (data.battle) handlersRef.current.onBattle?.(data.battle as StreamBattle);
          const event = parseFeedPayload(data);
          if (event) handlersRef.current.onFeedEvent?.(event);
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("reputation_movement", (raw) => {
        try {
          const data = JSON.parse(raw.data);
          if (data.movement) handlersRef.current.onReputation?.(data.movement as StreamReputationMovement);
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("pulse", (raw) => {
        try {
          const data = JSON.parse(raw.data);
          handlersRef.current.onPulse?.(data as StreamPulse);
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("heartbeat", () => setConnected(true));

      es.onerror = () => {
        setConnected(false);
        handlersRef.current.onDisconnected?.();
        es?.close();
        if (!cancelled) {
          retryTimer = setTimeout(() => {
            reconnectMs.current = Math.min(reconnectMs.current * 1.4, 30_000);
            open();
          }, reconnectMs.current);
        }
      };
    };

    open();

    return () => {
      cancelled = true;
      es?.close();
      if (retryTimer) clearTimeout(retryTimer);
      setConnected(false);
    };
  }, [chip, enabled]);

  return { connected };
}

/** Build partial pulse patch from stream pulse event */
export function pulseFromStream(p: StreamPulse, prev: PulseData | null): PulseData {
  const base = prev ?? {
    live_count: p.live_count ?? 0,
    latest_events: [],
    agent_flips: [],
    market_moves: [],
    new_receipts: [],
    position_activity: [],
  };
  return {
    ...base,
    live_count: p.live_count ?? base.live_count,
    network_headlines: p.pulse_headlines ?? base.network_headlines,
    narrative_labels: p.narrative_labels ?? base.narrative_labels,
  };
}
