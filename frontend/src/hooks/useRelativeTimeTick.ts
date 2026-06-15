"use client";

import { useEffect, useState } from "react";

/** Re-render children every minute so relative timestamps stay fresh. */
export function useRelativeTimeTick(intervalMs = 60_000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}
