"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import {
  hasIntelligenceAccess,
  setDevIntelligenceTier,
  type IntelligenceTier,
} from "@/lib/intelligence";

const IS_DEV = process.env.NODE_ENV === "development";

export function IntelligenceDevControls() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!IS_DEV || !user) return null;

  const apply = async (tier: IntelligenceTier) => {
    setLoading(true);
    setError(null);
    try {
      const ok = await setDevIntelligenceTier(user.email, tier);
      if (!ok) {
        setError("Could not update tier. Is the API running in a non-production ENV?");
        return;
      }
      await refreshUser();
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  };

  const enabled = hasIntelligenceAccess(user);

  return (
    <section className="mt-4 rounded-xl border border-dashed border-violet-500/40 bg-violet-950/20 p-4">
      <p className="text-[10px] uppercase tracking-[0.14em] text-violet-300/90">
        Dev testing
      </p>
      <p className="text-[11px] text-zinc-400 mt-1">
        Toggle Intelligence Access for <span className="text-zinc-200">{user.email}</span> without
        Stripe. UI updates immediately after refresh.
      </p>
      <p className="text-[10px] text-zinc-500 mt-2">
        Current tier:{" "}
        <span className={enabled ? "text-amber-300" : "text-zinc-300"}>
          {user.intelligence_tier}
        </span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => apply("free")}
          className="text-[11px] rounded-lg border border-zinc-600 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800/80 disabled:opacity-50"
        >
          Set Free
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => apply("intelligence_access")}
          className="text-[11px] rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
        >
          Set Intelligence Access
        </button>
      </div>
      {error && <p className="text-[11px] text-red-400 mt-2">{error}</p>}
    </section>
  );
}
