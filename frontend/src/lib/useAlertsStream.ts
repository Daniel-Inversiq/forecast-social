"use client";

import { useCallback, useRef, useState } from "react";
import type { RawAlert } from "@/components/alerts/types";
import {
  battleToRawAlert,
  feedEventToRawAlert,
  reputationToRawAlert,
} from "@/components/alerts/alertIntelligence";
import type { FeedEvent } from "@/components/feed/feedMix";
import type { StreamBattle, StreamReputationMovement } from "@/lib/useFeedStream";
import { useFeedStream } from "@/lib/useFeedStream";

const MAX_LIVE = 40;

export function useAlertsStream(enabled = true) {
  const [liveAlerts, setLiveAlerts] = useState<RawAlert[]>([]);
  const [newestId, setNewestId] = useState<string | null>(null);
  const seenRef = useRef(new Set<string>());

  const push = useCallback((alert: RawAlert) => {
    const key = `${alert.type}-${alert.timestamp}-${alert.title}`;
    if (seenRef.current.has(key)) return;
    seenRef.current.add(key);
    setLiveAlerts((prev) => [alert, ...prev].slice(0, MAX_LIVE));
    setNewestId(key);
  }, []);

  const { connected } = useFeedStream(
    "all",
    {
      onFeedEvent: (event: FeedEvent) => {
        if (event.type === "heartbeat") return;
        push(feedEventToRawAlert(event));
      },
      onBattle: (battle: StreamBattle) => {
        push(battleToRawAlert(battle));
      },
      onReputation: (movement: StreamReputationMovement) => {
        push(reputationToRawAlert(movement));
      },
    },
    enabled,
  );

  return { liveAlerts, connected, newestId };
}
