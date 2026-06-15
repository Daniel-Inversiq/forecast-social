"use client";

import { useEffect, useState } from "react";
import {
  BETA_ACTIVE_NOW_SSR_DEFAULT,
  BETA_NETWORK_SCALE,
  clampBetaLiveCount,
} from "@/lib/betaNetworkScale";

const STORAGE_KEY = "scry_beta_active_now_v1";

type ActiveNowState = {
  value: number;
  nextTickAt: number;
};

function hashTick(seed: number): number {
  return ((seed * 1103515245 + 12345) >>> 0) % 9973;
}

function initialBetaActiveNow(): number {
  const span =
    BETA_NETWORK_SCALE.activeNowBaseMax - BETA_NETWORK_SCALE.activeNowBaseMin + 1;
  const h = hashTick(Date.now() >>> 12);
  return BETA_NETWORK_SCALE.activeNowBaseMin + (h % span);
}

function readState(): ActiveNowState {
  if (typeof window === "undefined") {
    const value = initialBetaActiveNow();
    return { value, nextTickAt: Date.now() + 60_000 };
  }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ActiveNowState;
      if (
        typeof parsed.value === "number" &&
        typeof parsed.nextTickAt === "number"
      ) {
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  const value = initialBetaActiveNow();
  return { value, nextTickAt: Date.now() + 50_000 + (hashTick(value) % 40_000) };
}

function writeState(state: ActiveNowState): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/**
 * Live beta counter: stable base (60–90), subtle ±1–4 drift every 45–90s, clamped 25–150.
 */
export function getBetaActiveNow(): number {
  let state = readState();
  const now = Date.now();
  const { activeNowMin, activeNowMax } = BETA_NETWORK_SCALE;

  while (now >= state.nextTickAt) {
    const h = hashTick(state.value + Math.floor(state.nextTickAt / 1000));
    const delta = 1 + (h % 4);
    const direction = h % 2 === 0 ? 1 : -1;
    const nextValue = clampBetaLiveCount(state.value + direction * delta);
    const intervalMs = 45_000 + (h % 45_001);
    state = {
      value: Math.max(activeNowMin, Math.min(activeNowMax, nextValue)),
      nextTickAt: state.nextTickAt + intervalMs,
    };
  }

  writeState(state);
  return state.value;
}

/** Use API live_count when already in beta band; otherwise local beta pulse. */
export function resolveBetaLiveCount(apiCount?: number | null): number {
  if (apiCount != null && Number.isFinite(apiCount)) {
    const n = Math.round(apiCount);
    if (
      n >= BETA_NETWORK_SCALE.activeNowMin &&
      n <= BETA_NETWORK_SCALE.activeNowMax
    ) {
      return n;
    }
  }
  return getBetaActiveNow();
}

export function useBetaActiveNow(apiCount?: number | null): number {
  const [value, setValue] = useState(BETA_ACTIVE_NOW_SSR_DEFAULT);

  useEffect(() => {
    const refresh = () => setValue(resolveBetaLiveCount(apiCount));
    refresh();
    const id = window.setInterval(refresh, 8_000);
    return () => window.clearInterval(id);
  }, [apiCount]);

  return value;
}
