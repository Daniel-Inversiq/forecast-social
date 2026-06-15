"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "scry_checkin_streak";

type StoredStreak = { lastDay: string; streak: number };

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Read, advance, and persist the visit streak. Returns the current streak. */
export function advanceCheckinStreak(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const today = todayKey();
    let next: StoredStreak = { lastDay: today, streak: 1 };
    if (raw) {
      const stored = JSON.parse(raw) as StoredStreak;
      if (stored.lastDay === today) {
        next = stored;
      } else if (stored.lastDay === yesterdayKey()) {
        next = { lastDay: today, streak: stored.streak + 1 };
      }
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next.streak;
  } catch {
    return 0;
  }
}

/**
 * Daily check-in streak — the habit receipt. Client-side for now; moves
 * server-side once accounts track visits.
 */
export function DailyStreakChip({ className = "" }: { className?: string }) {
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setStreak(advanceCheckinStreak());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (streak < 2) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300/95 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full shrink-0 ${className}`}
      title={`You've checked the network ${streak} days in a row`}
    >
      <span aria-hidden>🔥</span>
      Day {streak}
    </span>
  );
}
