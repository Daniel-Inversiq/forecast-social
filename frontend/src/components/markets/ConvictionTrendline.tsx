"use client";

import { MiniSparkline } from "@/components/feed/shared";

export function ConvictionTrendline({
  seed,
  sentiment = "neutral",
  width = 64,
  height = 16,
}: {
  seed: string;
  sentiment?: "bullish" | "bearish" | "split" | "neutral";
  width?: number;
  height?: number;
}) {
  const tone =
    sentiment === "bullish"
      ? "emerald"
      : sentiment === "bearish"
        ? "amber"
        : sentiment === "split"
          ? "violet"
          : "sky";

  return (
    <div className="flex items-center gap-1.5">
      <MiniSparkline seed={seed} tone={tone} width={width} height={height} />
    </div>
  );
}
