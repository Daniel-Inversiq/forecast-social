"use client";

import { useEffect, useRef, useState } from "react";
import { resolveBetaLiveCount } from "@/lib/betaActiveNow";
import { BETA_ACTIVE_NOW_SSR_DEFAULT } from "@/lib/betaNetworkScale";

const MIN_DELAY_MS = 5_000;
const MAX_DELAY_MS = 10_000;
const FADE_MS = 220;

/** Weighted delta: mostly ±1–3, sometimes ±4–6, occasionally ±7–10. */
function nextDelta(): number {
  const roll = Math.random();
  if (roll < 0.62) {
    return Math.floor(Math.random() * 7) - 3;
  }
  if (roll < 0.88) {
    return Math.floor(Math.random() * 13) - 6;
  }
  return Math.floor(Math.random() * 21) - 10;
}

function nextPulsedCount(baseline: number): number {
  return Math.max(1, baseline + nextDelta());
}

function randomDelayMs(): number {
  return MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1));
}

/**
 * Navbar "active now" — pulses around the initial resolved count (client-only).
 */
export function useNavbarActiveNowPulse(apiCount?: number | null): {
  display: number;
  fading: boolean;
} {
  const baselineRef = useRef<number | null>(null);
  const [baseline, setBaseline] = useState<number | null>(null);
  const [display, setDisplay] = useState(BETA_ACTIVE_NOW_SSR_DEFAULT);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (baselineRef.current !== null) return;
    const initial = resolveBetaLiveCount(apiCount);
    baselineRef.current = initial;
    setBaseline(initial);
    setDisplay(initial);
  }, [apiCount]);

  useEffect(() => {
    if (baseline === null) return;

    let delayTimeoutId: number | null = null;
    let fadeTimeoutId: number | null = null;
    let cancelled = false;

    const scheduleTick = () => {
      delayTimeoutId = window.setTimeout(() => {
        if (cancelled) return;
        setFading(true);
        fadeTimeoutId = window.setTimeout(() => {
          if (cancelled) return;
          setDisplay(nextPulsedCount(baseline));
          setFading(false);
          scheduleTick();
        }, FADE_MS);
      }, randomDelayMs());
    };

    scheduleTick();

    return () => {
      cancelled = true;
      if (delayTimeoutId !== null) window.clearTimeout(delayTimeoutId);
      if (fadeTimeoutId !== null) window.clearTimeout(fadeTimeoutId);
    };
  }, [baseline]);

  return { display, fading };
}
