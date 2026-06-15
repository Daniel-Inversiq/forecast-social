"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatTimeAgo } from "@/components/feed/shared";
import type { PositionsPayload } from "@/components/positions/types";
import type { EnrichedUserProfile } from "./types";
import type { ScryReceipt } from "./reputation/types";
import { buildUserRecentActivity } from "./userRecentActivity";

export function UserRecentActivityList({
  profile,
  positions = null,
  scryReceipts = [],
  variant = "sidebar",
}: {
  profile: EnrichedUserProfile;
  positions?: PositionsPayload | null;
  scryReceipts?: ScryReceipt[];
  variant?: "sidebar" | "feed";
}) {
  const items = useMemo(
    () => buildUserRecentActivity(profile, positions, scryReceipts),
    [profile, positions, scryReceipts],
  );

  if (items.length === 0) {
    return (
      <p
        className={
          variant === "feed"
            ? "text-sm text-zinc-500 px-1"
            : "px-2 py-4 text-center text-[11px] text-zinc-500 leading-relaxed"
        }
      >
        Your moves will show up here — follow a forecaster, join a battle, or back a forecast.
      </p>
    );
  }

  const listClass =
    variant === "feed"
      ? "space-y-2.5"
      : "p-2 space-y-2";

  const itemClass =
    variant === "feed"
      ? "rounded-xl border border-zinc-800/70 bg-zinc-950/80 px-3 py-2.5"
      : "text-[10px] border-b border-zinc-800/40 last:border-0 pb-2 last:pb-0";

  const labelClass =
    variant === "feed"
      ? "text-[12px] font-medium text-zinc-200 leading-snug block"
      : "text-zinc-300 hover:text-violet-200 transition line-clamp-2 font-medium leading-snug block";

  const timeClass =
    variant === "feed"
      ? "text-[10px] text-zinc-600 mt-1 tabular-nums"
      : "text-[9px] text-zinc-600 mt-0.5 tabular-nums";

  return (
    <ul className={listClass}>
      {items.map((item) => (
        <li key={item.id} className={itemClass}>
          {item.href ? (
            <Link href={item.href} className={labelClass}>
              {item.label}
            </Link>
          ) : (
            <span
              className={
                variant === "feed"
                  ? "text-[12px] font-medium text-zinc-200 leading-snug block"
                  : "text-[10px] text-zinc-300 line-clamp-2 font-medium leading-snug block"
              }
            >
              {item.label}
            </span>
          )}
          <p className={timeClass}>{formatTimeAgo(item.created_at)}</p>
        </li>
      ))}
    </ul>
  );
}
