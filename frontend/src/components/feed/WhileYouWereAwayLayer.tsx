"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HeatPill, LiveDot } from "@/components/feed/shared";
import { useAuth } from "@/context/AuthProvider";
import {
  fetchPublicAwayBrief,
  recordHomeVisit,
  type AwayBrief,
  type AwayChange,
  type AwayChangeTone,
} from "@/lib/whileYouWereAway";

const WYWA_LOAD_TIMEOUT_MS = 8_000;
const MAX_CHANGES = 2;

const TONE: Record<AwayChangeTone, string> = {
  rose: "border-rose-500/25 bg-rose-950/30 hover:border-rose-500/40",
  violet: "border-violet-500/25 bg-violet-950/25 hover:border-violet-500/40",
  amber: "border-amber-500/25 bg-amber-950/25 hover:border-amber-500/40",
  cyan: "border-cyan-500/25 bg-cyan-950/20 hover:border-cyan-500/40",
  emerald: "border-emerald-500/25 bg-emerald-950/20 hover:border-emerald-500/40",
  sky: "border-sky-500/25 bg-sky-950/25 hover:border-sky-500/40",
};

function ChangeItem({ change, compact }: { change: AwayChange; compact?: boolean }) {
  const cls = TONE[change.tone] ?? TONE.violet;
  const inner = (
    <>
      <p className={`font-medium text-zinc-100 leading-snug ${compact ? "text-[10px]" : "text-[11px]"}`}>
        {change.line}
      </p>
      <span className="text-[9px] text-violet-300/80 mt-1 inline-block group-hover:text-violet-200 transition">
        {change.cta_label} →
      </span>
    </>
  );

  const pad = compact ? "px-2 py-1.5" : "px-3 py-2.5";

  if (change.cta_href.startsWith("#")) {
    return (
      <a href={change.cta_href} className={`group rounded-lg border ${pad} transition ${cls}`}>
        {inner}
      </a>
    );
  }

  return (
    <Link href={change.cta_href} className={`group block rounded-lg border ${pad} feed-hover-lift transition ${cls}`}>
      {inner}
    </Link>
  );
}

function QuietStrip({ brief, eyebrow }: { brief: AwayBrief; eyebrow: string }) {
  return (
    <section className="wywa-layer wywa-layer--quiet rounded-lg border border-cyan-500/15 bg-zinc-950/90 px-2.5 py-2 feed-fade-in min-h-0">
      <p className="text-[10px] text-zinc-500 leading-snug truncate">
        <span className="text-cyan-400/70 font-medium mr-1.5">{eyebrow}</span>
        {brief.headline}
      </p>
    </section>
  );
}

export function WhileYouWereAwayLayer() {
  const { user, loading: authLoading } = useAuth();
  const [brief, setBrief] = useState<AwayBrief | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      cancelled = true;
      if (process.env.NODE_ENV !== "production") {
        console.error("[WhileYouWereAwayLayer] load timeout");
      }
      setLoading(false);
    }, WYWA_LOAD_TIMEOUT_MS);

    async function load() {
      setLoading(true);
      try {
        const data = user ? await recordHomeVisit() : await fetchPublicAwayBrief();
        if (!cancelled) setBrief(data);
      } catch (err) {
        if (!cancelled && process.env.NODE_ENV !== "production") {
          console.error("[WhileYouWereAwayLayer] load failed", err);
        }
      } finally {
        if (!cancelled) {
          clearTimeout(timeoutId);
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [user, authLoading]);

  if (loading && !brief) return null;
  if (!brief) return null;

  const hasChanges = brief.changes.length > 0;
  const isFirstVisit = brief.state === "first_visit";
  const isQuiet = brief.state === "quiet";
  const isPublic = brief.state === "public";
  const eyebrow = isPublic ? "Network moved" : isFirstVisit ? "Welcome" : "While you were away";

  if ((isQuiet || (isFirstVisit && !hasChanges)) && !hasChanges) {
    if (isQuiet) {
      return <QuietStrip brief={brief} eyebrow={eyebrow} />;
    }
    return null;
  }

  const changes = brief.changes.slice(0, MAX_CHANGES);

  return (
    <section className="wywa-layer wywa-layer--compact rounded-lg border border-cyan-500/20 bg-gradient-to-br from-cyan-950/15 via-zinc-950/98 to-zinc-950/98 overflow-hidden feed-fade-in h-full min-h-0">
      <div className="relative px-2.5 py-2 sm:px-3 sm:py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <LiveDot color="violet" />
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-300/90">
              {eyebrow}
            </p>
            {hasChanges && (
              <HeatPill tone="sky">
                {brief.changes.length} signal{brief.changes.length !== 1 ? "s" : ""}
              </HeatPill>
            )}
          </div>
          {brief.cta_primary && (
            <Link
              href={brief.cta_primary.href}
              className="text-[9px] font-medium text-cyan-300/90 hover:text-cyan-200 shrink-0 transition"
            >
              {brief.cta_primary.label} →
            </Link>
          )}
        </div>

        <h2 className="text-[12px] font-semibold text-white tracking-tight leading-snug line-clamp-2 mb-2">
          {brief.headline}
        </h2>

        {hasChanges && (
          <div className="grid grid-cols-1 gap-1.5">
            {changes.map((change) => (
              <ChangeItem key={change.id} change={change} compact />
            ))}
          </div>
        )}

        {isFirstVisit && !hasChanges && (
          <p className="text-[10px] text-zinc-500 leading-snug">
            Follow an agent or take a position — your next visit surfaces what moved.
          </p>
        )}
      </div>
    </section>
  );
}
