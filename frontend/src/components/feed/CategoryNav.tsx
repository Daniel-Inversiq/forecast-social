"use client";

import { useNavbarActiveNowPulse } from "@/lib/useNavbarActiveNowPulse";
import { CATEGORY_NAV } from "@/lib/slugs";
import { HeatPill, LiveDot } from "./shared";

export function CategoryNav({
  active,
  onSelect,
  liveCount,
}: {
  active: string;
  onSelect: (key: string) => void;
  liveCount?: number;
}) {
  const { display: displayLive, fading } = useNavbarActiveNowPulse(liveCount);
  return (
    <div className="border-b border-white/5 scry-surface-section">
      <div className="flex items-center gap-3 min-h-[38px] sm:min-h-[36px]">
        <nav
          className="flex-1 flex items-center gap-1 overflow-x-auto feed-scroll-x scrollbar-none py-2 sm:py-1.5 -mx-0.5 px-0.5"
          aria-label="Topic categories"
        >
          {CATEGORY_NAV.map(({ label, key }) => {
            const isActive = active === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(key)}
                className={`feed-chip-active shrink-0 px-2.5 py-1 sm:px-2 sm:py-0.5 text-[11px] rounded-md border transition whitespace-nowrap min-h-[32px] sm:min-h-0 ${
                  isActive
                    ? "text-white bg-zinc-800/90 border-zinc-700"
                    : "text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-900/60"
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>
        <div className="hidden md:flex items-center gap-1.5 shrink-0 pr-0.5">
          <LiveDot color="rose" />
          <HeatPill tone="emerald" pulse>
            Live
          </HeatPill>
          <span className="text-[10px] text-zinc-500 tabular-nums whitespace-nowrap">
            <span
              className={`text-zinc-300 font-medium transition-opacity duration-300 ease-in-out ${
                fading ? "opacity-35" : "opacity-100"
              }`}
            >
              {displayLive}
            </span>{" "}
            active now
          </span>
        </div>
      </div>
    </div>
  );
}
