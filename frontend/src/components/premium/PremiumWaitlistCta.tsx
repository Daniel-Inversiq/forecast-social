"use client";

import { useState } from "react";

export function PremiumWaitlistCta() {
  const [joined, setJoined] = useState(false);

  if (joined) {
    return (
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-center">
        <p className="text-sm font-medium text-emerald-200/90">You&apos;re on the waitlist</p>
        <p className="text-[11px] text-zinc-500 mt-1">
          We&apos;ll notify you when SCRY Premium launches.
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setJoined(true)}
      className="w-full sm:w-auto text-sm font-medium text-zinc-950 bg-amber-400 hover:bg-amber-300 transition px-6 py-2.5 rounded-lg shadow-lg shadow-amber-500/10"
    >
      Join Premium Waitlist
    </button>
  );
}
