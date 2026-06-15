"use client";

import type { ReactNode } from "react";

/** Side-by-side compact WYWA + Ongoing Stories on desktop; stacked on narrow viewports. */
export function FeedLiveContextRow({ children }: { children: ReactNode }) {
  return (
    <div className="feed-live-context-row grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5 sm:items-stretch">
      {children}
    </div>
  );
}
