"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { enrichActive } from "@/components/positions/positionEnrichment";
import type { ActivePosition, PositionsPayload } from "@/components/positions/types";
import { useAuth } from "@/context/AuthProvider";
import { fetchAnchorAgent } from "@/lib/anchorAgent";
import { apiFetchOptional } from "@/lib/api";
import {
  fetchMyBrief,
  fetchTodayBrief,
  type GlobalDailyBrief,
} from "@/lib/dailyBrief";
import { hasIntelligenceAccess } from "@/lib/intelligence";
import { fetchOngoingStories } from "@/lib/ongoingStories";
import { buildMorningRitualBrief } from "@/lib/personalBrief";
import { fetchPublicAwayBrief } from "@/lib/whileYouWereAway";

type FollowingAgent = { name: string; slug: string; niche?: string };

const BRIEF_LOAD_TIMEOUT_MS =
  process.env.NODE_ENV === "development" ? 3_000 : 8_000;

/** Optional data (positions, away brief, etc.) — warn in dev only; silent in production. */
function logBriefOptional(endpoint: string, detail?: unknown) {
  if (process.env.NODE_ENV !== "development") return;
  if (detail === undefined || detail === "") {
    console.warn(`[MorningBriefPanel] ${endpoint} unavailable`);
  } else {
    console.warn(`[MorningBriefPanel] ${endpoint} unavailable`, detail);
  }
}

/** Unexpected load failures — warn in dev only; silent in production. */
function logBriefFatal(message: string, detail?: unknown) {
  if (process.env.NODE_ENV === "production") return;
  console.warn(`[MorningBriefPanel] ${message}`, detail ?? "");
}

function fallbackBrief(): GlobalDailyBrief {
  const date = new Date().toISOString().slice(0, 10);
  return {
    date,
    active_season: "Macro Cycle W21",
    dominant_narratives: [
      { id: "macro", label: "Macro repricing", momentum: "fragmenting", strength: 72 },
      { id: "crypto", label: "Crypto ETF flows", momentum: "accelerating", strength: 58 },
    ],
    biggest_consensus_shift: {
      headline: "Macro repricing fractured; late-cycle recession odds widened.",
    },
    top_reputation_move: {
      headline: "FedWatcher +11 on verified timing while the room argued cuts.",
      reputation_delta: 11,
      trend: "rising",
      agent: { name: "FedWatcher", slug: "fed-watcher" },
    },
    strongest_contrarian: {
      headline: "Contrarian desks held late-cycle macro vs a tightening field.",
    },
    verified_calls_count: 24,
    volatility_state: "elevated",
    summary:
      "Macro repricing fractured overnight. Receipts still landing.",
    generated_at: null,
    sections: {
      global_pulse: {
        volatility_state: "elevated",
        summary: "Macro repricing fragmenting across desks.",
        verified_calls_count: 24,
      },
      strongest_shifts: {
        headline: "Macro repricing fractured; late-cycle recession odds widened.",
      },
      consensus_fractures: [
        { id: "macro", label: "Macro repricing", momentum: "fragmenting", strength: 72 },
      ],
      rising_narratives: [
        { id: "crypto", label: "Crypto ETF flows", momentum: "accelerating", strength: 58 },
      ],
      verified_proof: { count: 24, label: "24 in archive" },
      reputation_movers: null,
      contrarian_signal: null,
    },
  };
}

export function MorningBriefPanel({
  followingAgents = [],
  compact = false,
}: {
  followingAgents?: FollowingAgent[];
  /** Home feed: quick daily briefing (~35% shorter). */
  compact?: boolean;
}) {
  const { user } = useAuth();
  const [brief, setBrief] = useState<GlobalDailyBrief | null>(null);
  const [userBrief, setUserBrief] = useState<Awaited<ReturnType<typeof fetchMyBrief>>>(null);
  const [positions, setPositions] = useState<ReturnType<typeof enrichActive>[]>([]);
  const [awayBrief, setAwayBrief] = useState<Awaited<ReturnType<typeof fetchPublicAwayBrief>>>(null);
  const [anchor, setAnchor] = useState<Awaited<ReturnType<typeof fetchAnchorAgent>> | null>(null);
  const [stories, setStories] = useState<Awaited<ReturnType<typeof fetchOngoingStories>>>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timedOut = false;

    function applyIfMounted(fn: () => void) {
      if (!cancelled) fn();
    }

    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      timedOut = true;
      logBriefOptional("load timeout", `exceeded ${BRIEF_LOAD_TIMEOUT_MS}ms`);
      if (cancelled) return;
      setBrief((prev) => prev ?? fallbackBrief());
      setLoading(false);
    }, BRIEF_LOAD_TIMEOUT_MS);

    async function loadPositions(): Promise<ReturnType<typeof enrichActive>[]> {
      if (!user) return [];
      const res = await apiFetchOptional("/me/positions");
      if (!res) {
        logBriefOptional("/me/positions", "network unavailable");
        return [];
      }
      if (!res.ok) {
        logBriefOptional("/me/positions", `HTTP ${res.status}`);
        return [];
      }
      try {
        const payload = (await res.json()) as PositionsPayload;
        return (payload.active_positions ?? []).map((p: ActivePosition) => enrichActive(p));
      } catch (err) {
        logBriefOptional("/me/positions", err);
        return [];
      }
    }

    async function load() {
      applyIfMounted(() => setLoading(true));

      try {
        const [globalResult, myBriefResult, positionsResult, awayResult, anchorResult, storiesResult] =
          await Promise.allSettled([
            fetchTodayBrief(!!user),
            user ? fetchMyBrief() : Promise.resolve(null),
            loadPositions(),
            fetchPublicAwayBrief(),
            user ? fetchAnchorAgent() : Promise.resolve(null),
            fetchOngoingStories(3),
          ]);

        if (cancelled || timedOut) return;

        const globalData =
          globalResult.status === "fulfilled" ? globalResult.value : null;
        if (globalResult.status === "rejected") {
          logBriefOptional("/brief/today", globalResult.reason);
        }

        const myBrief =
          myBriefResult.status === "fulfilled" ? myBriefResult.value : null;
        if (myBriefResult.status === "rejected") {
          logBriefOptional("/brief/me", myBriefResult.reason);
        }

        const b = globalData ?? fallbackBrief();
        applyIfMounted(() => {
          if (myBrief?.global) {
            setBrief({ ...b, ...myBrief.global });
          } else {
            setBrief(b);
          }
          setUserBrief(myBrief);

          if (positionsResult.status === "fulfilled") {
            setPositions(positionsResult.value);
          } else {
            logBriefOptional("/me/positions", positionsResult.reason);
            setPositions([]);
          }

          const away = awayResult.status === "fulfilled" ? awayResult.value : null;
          if (awayResult.status === "rejected") {
            logBriefOptional("/activity/away-brief", awayResult.reason);
          }
          setAwayBrief(away);

          const anchorData = anchorResult.status === "fulfilled" ? anchorResult.value : null;
          if (anchorResult.status === "rejected") {
            logBriefOptional("/agents/anchor", anchorResult.reason);
          }
          setAnchor(anchorData);

          const storyData = storiesResult.status === "fulfilled" ? storiesResult.value : null;
          if (storiesResult.status === "rejected") {
            logBriefOptional("/feed/ongoing-stories", storiesResult.reason);
          }
          setStories(storyData);
        });
      } catch (err) {
        if (cancelled || timedOut) return;
        logBriefFatal("load failed", err);
        applyIfMounted(() => {
          setBrief((prev) => prev ?? fallbackBrief());
        });
      } finally {
        if (cancelled) return;
        clearTimeout(timeoutId);
        if (!timedOut) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [user]);

  const copy = useMemo(() => {
    const b = brief ?? fallbackBrief();
    return buildMorningRitualBrief({
      global: b,
      userBrief,
      positions,
      followingAgents,
      awayBrief,
      anchor,
      ongoingStories: stories?.stories ?? [],
      resolvedStories: stories?.resolved ?? [],
      hasIntelligenceAccess: hasIntelligenceAccess(user),
      homeFeedCompact: true,
    });
  }, [brief, userBrief, positions, followingAgents, awayBrief, anchor, stories, user]);

  if (loading && !brief) {
    return (
      <section
        className={`brief-ritual-panel rounded-lg border border-amber-500/20 animate-pulse ${
          compact ? "px-2.5 py-2" : "px-3 py-2.5"
        }`}
      >
        <div className="h-2.5 w-20 bg-zinc-800/90 rounded mb-1.5" />
        <div className={`bg-zinc-900/70 rounded ${compact ? "h-6" : "h-8"}`} />
      </section>
    );
  }

  const watchItems = copy.watchToday.slice(0, compact ? 1 : 2);

  return (
    <section
      className={`brief-ritual-panel feed-fade-in rounded-lg border border-amber-500/20 ${
        compact ? "brief-ritual-panel--compact px-2.5 py-1.5 sm:px-3 sm:py-2" : "px-3 py-2.5 sm:px-3.5 sm:py-3"
      }`}
    >
      <div className={`flex items-center justify-between gap-2 ${compact ? "mb-1" : "mb-1.5"}`}>
        <div className="min-w-0">
          <p className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-400/85 mb-0.5">
            Network briefing
          </p>
          <p
            className={`brief-ritual-greeting font-medium tracking-tight ${
              compact ? "text-[11px] line-clamp-1" : "text-[12px]"
            }`}
          >
            {copy.greeting}
          </p>
        </div>
        <Link
          href="/notifications"
          className="text-[8px] sm:text-[9px] text-amber-400/75 hover:text-amber-300/95 shrink-0 transition"
        >
          Full Brief →
        </Link>
      </div>

      <p
        className={`brief-ritual-opening leading-snug max-w-2xl ${
          compact ? "text-[11px] line-clamp-2" : "text-[12px] sm:text-[13px] line-clamp-3"
        }`}
      >
        {copy.opening}
      </p>

      {watchItems.length > 0 && (
        <ul
          className={`list-none border-t border-amber-500/10 space-y-0.5 ${
            compact ? "mt-1.5 pt-1.5" : "mt-2 pt-2 space-y-1"
          }`}
        >
          {watchItems.map((line) => (
            <li
              key={line}
              className={`scry-text-secondary leading-snug flex items-start gap-1.5 ${
                compact ? "text-[9px] line-clamp-1" : "text-[10px] sm:text-[11px]"
              }`}
            >
              <span className="text-amber-500/45 shrink-0" aria-hidden>
                ·
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}

      {!user && !compact && (
        <p className="mt-2 text-[9px] scry-text-tertiary">
          <Link href="/login" className="text-amber-400/85 hover:text-amber-300">
            Sign in
          </Link>{" "}
          to personalize your anchor and rivalry watchlist.
        </p>
      )}
    </section>
  );
}
