"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isOnboardingComplete, isOnboardingCompleteLocal } from "@/lib/onboarding";

export function OnboardingBadge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const complete = await isOnboardingComplete();
      if (!cancelled) setShow(!complete);
    }

    const refreshLocal = () => {
      if (isOnboardingCompleteLocal()) {
        setShow(false);
        return;
      }
      void refresh();
    };

    refreshLocal();
    window.addEventListener("forecast-onboarding-change", refreshLocal);
    window.addEventListener("storage", refreshLocal);

    return () => {
      cancelled = true;
      window.removeEventListener("forecast-onboarding-change", refreshLocal);
      window.removeEventListener("storage", refreshLocal);
    };
  }, []);

  if (!show) return null;

  return (
    <Link
      href="/onboarding"
      className="shrink-0 text-xs font-medium text-violet-200 px-2.5 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 hover:border-violet-400/40 transition shadow-[0_0_20px_-8px_rgba(139,92,246,0.6)]"
    >
      Complete profile
    </Link>
  );
}
