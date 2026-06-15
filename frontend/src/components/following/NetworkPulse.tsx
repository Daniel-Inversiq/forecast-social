"use client";

import { useEffect, useState } from "react";
import { HeatPill, LiveDot } from "@/components/feed/shared";

type PulseItem = {
  label: string;
  value: string;
  tone?: "violet" | "emerald" | "rose" | "amber";
};

export function NetworkPulse({ items }: { items: PulseItem[] }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="px-3 py-2 space-y-2">
      <div className="flex items-center gap-1.5">
        <LiveDot color={tick % 2 === 0 ? "violet" : "rose"} />
        <HeatPill tone="violet" pulse>
          Live pulse
        </HeatPill>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li
            key={item.label}
            className={`flex items-center justify-between gap-2 text-[10px] feed-fade-in feed-stagger-${Math.min(i, 5)}`}
          >
            <span className="text-zinc-600 shrink-0">{item.label}</span>
            <span
              className={`font-medium truncate text-right ${
                item.tone === "emerald"
                  ? "text-emerald-400/90"
                  : item.tone === "rose"
                    ? "text-rose-400/90"
                    : item.tone === "amber"
                      ? "text-amber-400/90"
                      : "text-zinc-300"
              }`}
            >
              {item.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
