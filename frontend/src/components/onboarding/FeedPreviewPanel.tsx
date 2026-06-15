"use client";

import { LiveDot } from "@/components/feed/shared";
import { buildFeedPreview, type ConvictionStyleId, type Interest } from "@/lib/onboarding";

const toneRing: Record<string, string> = {
  violet: "border-violet-500/30 bg-violet-500/8",
  sky: "border-sky-500/30 bg-sky-500/8",
  emerald: "border-emerald-500/30 bg-emerald-500/8",
  amber: "border-amber-500/30 bg-amber-500/8",
  rose: "border-rose-500/30 bg-rose-500/8",
};

const typeLabel: Record<string, string> = {
  battle: "Battle",
  signal: "Signal",
  verified: "Verified",
  season: "Season",
  market: "Market",
  rivalry: "Rivalry",
};

export function FeedPreviewPanel({
  interests,
  convictionStyle,
  followedSlugs,
  compact = false,
}: {
  interests: Interest[];
  convictionStyle: ConvictionStyleId | null;
  followedSlugs: string[];
  compact?: boolean;
}) {
  const items = buildFeedPreview(interests, convictionStyle, followedSlugs);

  return (
    <aside
      className={`onboarding-glass rounded-2xl border border-zinc-800/50 overflow-hidden ${
        compact ? "p-3" : "p-4 sm:p-5"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300/90">
          Curated induction
        </p>
        <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400/90">
          <LiveDot />
          Live
        </span>
      </div>
      <ul className={`space-y-2 ${compact ? "" : "sm:space-y-2.5"}`}>
        {items.map((item, i) => (
          <li
            key={item.title}
            className={`onboarding-preview-item rounded-xl border px-3 py-2.5 transition-all duration-500 ${toneRing[item.tone]}`}
            style={{ animationDelay: `${i * 120}ms` }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                {typeLabel[item.type]}
              </span>
            </div>
            <p className={`font-medium text-white leading-snug ${compact ? "text-xs" : "text-sm"}`}>
              {item.title}
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{item.subtitle}</p>
          </li>
        ))}
      </ul>
      {interests.length === 0 && (
        <p className="text-[10px] text-zinc-600 mt-2 text-center">
          Select narrative domains to shape your first network path
        </p>
      )}
    </aside>
  );
}
