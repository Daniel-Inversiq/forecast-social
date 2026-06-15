/** Lightweight motion tokens — CSS-only, no layout thrashing */

export const springEase = "cubic-bezier(0.34, 1.2, 0.64, 1)";
export const smoothEase = "cubic-bezier(0.4, 0, 0.2, 1)";

export const motionClass = {
  cardEnter: "feed-card-enter",
  cardEnterStagger: (i: number) =>
    `feed-card-enter feed-stagger-${Math.min(i, 12)}` as const,
  fadeIn: "feed-fade-in",
  fadeOut: "feed-fade-out",
  hoverLift: "feed-hover-lift",
  expandReveal: "feed-expand-reveal",
  chipActive: "feed-chip-active",
  pulseFloat: "feed-pulse-float",
  probAnimate: "feed-prob-animate",
  narrativePulse: "feed-narrative-pulse",
  momentumUp: "feed-momentum-up",
  momentumDown: "feed-momentum-down",
} as const;

/** Deterministic sparkline from a seed string */
export function sparklinePoints(seed: string, len = 8): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const pts: number[] = [];
  for (let i = 0; i < len; i++) {
    h = (h * 1103515245 + 12345) | 0;
    pts.push(0.2 + ((h >>> 16) % 80) / 100);
  }
  return pts;
}

export function momentumFromSeed(seed: string): "up" | "down" | "flat" {
  const pts = sparklinePoints(seed, 6);
  const first = pts.slice(0, 3).reduce((a, b) => a + b, 0);
  const last = pts.slice(-3).reduce((a, b) => a + b, 0);
  if (last - first > 0.08) return "up";
  if (first - last > 0.08) return "down";
  return "flat";
}

export function rankDeltaFromSeed(seed: string): number {
  const h = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return (h % 5) + 1;
}
