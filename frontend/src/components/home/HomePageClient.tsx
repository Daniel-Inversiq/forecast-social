"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConvictionStream } from "@/components/feed/ConvictionStream";
import { DailyStreakChip } from "@/components/feed/DailyStreakChip";
import { FeedShell } from "@/components/feed/FeedShell";
import { FeedSidebarPriority } from "@/components/feed/FeedSidebarPriority";
import { FeedStatsBar } from "@/components/feed/FeedStatsBar";
import { TodaysVerdicts } from "@/components/feed/TodaysVerdicts";
import { MorningBriefPanel } from "@/components/brief/MorningBriefPanel";
import { chipToApiParam, type FeedEvent } from "@/components/feed/feedMix";
import { safeEnrichFeedEvents } from "@/components/feed/feedEnrichment";
import { LiveDot } from "@/components/feed/shared";
import type { PulseData } from "@/components/LivePulsePanel";
import { useOngoingStoryKeys } from "@/hooks/useOngoingStoryKeys";
import { resolveBetaLiveCount } from "@/lib/betaActiveNow";
import { apiFetch, apiFetchOptional } from "@/lib/api";
import { rosterToFallbackAgents } from "@/lib/agentRoster";
import {
  buildAgentCatalog,
  fetchGeneratedFeedItems,
  mergeGeneratedIntoFeed,
  type AgentCatalogEntry,
} from "@/lib/generatedFeed";
import {
  feedLoadLog,
  GENERATED_FETCH_TIMEOUT_MS,
  INITIAL_FEED_RENDER_CAP,
  withPromiseTimeout,
} from "@/lib/feedLoadLog";
import {
  clearExpiredStreamFlags,
  clearShowNew,
  feedStreamLog,
  insertStreamedEvent,
  mergeFetchedWithStreamState,
  tagStreamedEvent,
} from "@/lib/feedStreamMerge";
import {
  pulseFromStream,
  useFeedStream,
  type StreamBattle,
  type StreamPulse,
  type StreamReputationMovement,
} from "@/lib/useFeedStream";

const IS_DEV = process.env.NODE_ENV === "development";
if (IS_DEV && typeof window !== "undefined") {
  console.log("[home] module loaded");
}

type FollowingAgent = {
  name: string;
  slug: string;
  niche: string;
  avatar_color: string;
};

type NetworkHeadline = {
  type: string;
  text: string;
  intensity: number;
};

const FEED_POLL_MIN_MS = 85_000;
const FEED_POLL_MAX_MS = 165_000;
const STATIC_LOAD_TIMEOUT_MS = 8_000;

function fallbackAgentCatalog(): Map<string, AgentCatalogEntry> {
  return buildAgentCatalog(
    rosterToFallbackAgents().map((a) => ({
      name: a.name,
      slug: a.slug,
      niche: a.niche,
      avatar_color: a.avatar_color,
    })),
  );
}

async function withLoadTimeout(
  promise: Promise<Response | null>,
  ms: number,
): Promise<Response | null> {
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
    ]);
  } catch {
    return null;
  }
}

function feedUrl(chip: string) {
  const param = chipToApiParam(chip);
  return param ? `/feed?chip=${param}` : "/feed";
}

function insertBuffered(events: FeedEvent[], incoming: FeedEvent, max = 40): FeedEvent[] {
  const tagged = tagStreamedEvent(incoming);
  if (tagged.id != null && events.some((e) => e.id === tagged.id)) {
    feedStreamLog("duplicate skipped (buffer)", tagged.id);
    return events;
  }
  return [tagged, ...events].slice(0, max);
}

export default function HomePageClient() {
  if (IS_DEV && typeof window !== "undefined") {
    console.log("[home] component render");
  }

  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [buffered, setBuffered] = useState<FeedEvent[]>([]);
  const [followingAgents, setFollowingAgents] = useState<FollowingAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("trending");
  const [liveCount, setLiveCount] = useState<number | null>(null);
  const [headlines, setHeadlines] = useState<NetworkHeadline[]>([]);
  const [feedChip, setFeedChip] = useState("For You");
  const [streamPulse, setStreamPulse] = useState<PulseData | null>(null);
  const [streamBattles, setStreamBattles] = useState<StreamBattle[]>([]);
  const [streamRepMoves, setStreamRepMoves] = useState<StreamReputationMovement[]>([]);
  const [streamStats, setStreamStats] = useState({
    verified: 0,
    battles: 0,
    repShifts: 0,
  });
  const scrolledAway = useRef(false);
  const streamConnectedRef = useRef(false);
  const [agentCatalog, setAgentCatalog] = useState<Map<string, AgentCatalogEntry>>(new Map());
  const agentCatalogHydrated = useRef(false);
  const agentCatalogRef = useRef(agentCatalog);
  agentCatalogRef.current = agentCatalog;
  const staticLoadedRef = useRef(false);
  const feedRetryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const feedLoadSeqRef = useRef(0);
  const { activeStoryKeys } = useOngoingStoryKeys();

  const loadFeed = useCallback(async (chip: string, silent = false) => {
    const seq = ++feedLoadSeqRef.current;
    if (!silent) setLoading(true);
    setError(null);
    feedLoadLog("fetchFeed start", { chip, silent, seq });

    const commitFeed = (events: FeedEvent[]) => {
      if (seq !== feedLoadSeqRef.current) return;
      setFeed((prev) => {
        const merged = mergeFetchedWithStreamState(events, prev);
        return clearExpiredStreamFlags(merged);
      });
    };

    const finishLoading = () => {
      if (!silent && seq === feedLoadSeqRef.current) {
        setLoading(false);
      }
    };

    try {
      let feedRes: Response;
      try {
        feedRes = await apiFetch(feedUrl(chip));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        if (msg !== "Failed to fetch") {
          setError(msg);
        } else {
          setError("Could not reach the API. Check that the backend is running.");
        }
        feedLoadLog("fetchFeed network error", { seq, message: msg });
        return;
      }

      if (seq !== feedLoadSeqRef.current) return;

      if (feedRes.status === 429) {
        setError("Feed temporarily rate limited. Retrying...");
        if (feedRetryTimerRef.current) clearTimeout(feedRetryTimerRef.current);
        feedRetryTimerRef.current = setTimeout(() => {
          void loadFeed(chip, true);
        }, 5_000);
        feedLoadLog("fetchFeed rate limited", { seq });
        return;
      }

      if (!feedRes.ok) {
        setError(`Could not load conviction stream (${feedRes.status})`);
        feedLoadLog("fetchFeed bad status", { seq, status: feedRes.status });
        return;
      }

      const rawText = await feedRes.text();
      feedLoadLog("fetchFeed response", {
        seq,
        bytes: rawText.length,
        status: feedRes.status,
      });

      let data: unknown;
      try {
        data = JSON.parse(rawText);
      } catch {
        setError("Feed response was not valid JSON");
        feedLoadLog("fetchFeed json parse failed", { seq });
        return;
      }

      const raw = Array.isArray(data) ? data : (data as { events?: unknown })?.events;
      if (!Array.isArray(raw)) {
        setError("Feed response was not an array");
        feedLoadLog("fetchFeed invalid shape", { seq });
        return;
      }

      feedLoadLog("fetchFeed items", {
        seq,
        count: raw.length,
        capped: Math.min(raw.length, INITIAL_FEED_RENDER_CAP),
      });

      const cappedRaw = raw.slice(0, INITIAL_FEED_RENDER_CAP);
      const { events: enriched, skippedIds } = safeEnrichFeedEvents(cappedRaw);
      if (skippedIds.length > 0) {
        feedLoadLog("fetchFeed enrich skipped", { seq, skippedIds });
      }

      commitFeed(enriched);
      finishLoading();
      feedLoadLog("fetchFeed render ready", { seq, count: enriched.length });

      const generatedItems =
        (await withPromiseTimeout(
          fetchGeneratedFeedItems(apiFetchOptional),
          GENERATED_FETCH_TIMEOUT_MS,
          "fetchGeneratedFeedItems",
        )) ?? [];

      if (seq !== feedLoadSeqRef.current) return;

      let withGenerated: FeedEvent[];
      try {
        withGenerated = mergeGeneratedIntoFeed(
          enriched,
          generatedItems,
          agentCatalogRef.current,
          chip,
        );
      } catch (mergeErr) {
        feedLoadLog("mergeGeneratedIntoFeed failed", {
          seq,
          message: mergeErr instanceof Error ? mergeErr.message : String(mergeErr),
        });
        return;
      }

      commitFeed(withGenerated.slice(0, INITIAL_FEED_RENDER_CAP));
      feedLoadLog("fetchFeed merge complete", {
        seq,
        count: withGenerated.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected feed load error";
      feedLoadLog("fetchFeed unexpected error", { seq, message });
      if (!silent) setError(message);
    } finally {
      finishLoading();
    }
  }, []);

  const loadIntelligence = useCallback(async () => {
    const res = await apiFetchOptional("/feed/intelligence");
    if (!res?.ok) return;
    try {
      const meta = await res.json();
      if (meta.live_count != null) setLiveCount(resolveBetaLiveCount(meta.live_count));
      if (Array.isArray(meta.pulse_headlines)) {
        setHeadlines(meta.pulse_headlines);
      }
    } catch {
      /* optional sidebar / ticker metadata */
    }
  }, []);

  const pushFeedEvent = useCallback((event: FeedEvent) => {
    if (scrolledAway.current) {
      setBuffered((b) => insertBuffered(b, event));
      return;
    }
    setFeed((f) => {
      const { events, inserted, duplicate } = insertStreamedEvent(f, event);
      if (!inserted && duplicate) return f;
      return events;
    });
  }, []);

  const streamHandlers = useMemo(
    () => ({
      onFeedEvent: pushFeedEvent,
      onVerifiedCall: () => {
        setStreamStats((s) => ({ ...s, verified: s.verified + 1 }));
      },
      onBattle: (battle: StreamBattle) => {
        setStreamBattles((b) => [battle, ...b].slice(0, 6));
        setStreamStats((s) => ({ ...s, battles: s.battles + 1 }));
      },
      onReputation: (movement: StreamReputationMovement) => {
        setStreamRepMoves((m) => [movement, ...m].slice(0, 6));
        setStreamStats((s) => ({ ...s, repShifts: s.repShifts + 1 }));
      },
      onPulse: (p: StreamPulse) => {
        if (p.live_count != null) setLiveCount(resolveBetaLiveCount(p.live_count));
        if (p.pulse_headlines?.length) setHeadlines(p.pulse_headlines);
        setStreamPulse((prev) => pulseFromStream(p, prev));
      },
      onConnected: () => {
        streamConnectedRef.current = true;
        feedStreamLog("SSE connected");
      },
      onDisconnected: () => {
        streamConnectedRef.current = false;
        feedStreamLog("SSE disconnected");
      },
    }),
    [pushFeedEvent],
  );

  const { connected: streamConnected } = useFeedStream(feedChip, streamHandlers);

  useEffect(() => {
    console.log("[home] useEffect mounted");
    void loadFeed(feedChip);
  }, [feedChip, loadFeed]);

  useEffect(() => {
    const id = setInterval(() => {
      setFeed((f) => clearExpiredStreamFlags(f));
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const newIds = feed.filter((e) => e.show_new && e.id != null).map((e) => e.id!);
    if (!newIds.length) return;
    const t = setTimeout(() => setFeed((f) => clearShowNew(f, newIds)), 8_000);
    return () => clearTimeout(t);
  }, [feed]);

  useEffect(() => {
    if (staticLoadedRef.current) return;
    staticLoadedRef.current = true;

    let cancelled = false;

    async function loadStatic() {
      const [followingRes, agentsRes] = await Promise.all([
        withLoadTimeout(apiFetchOptional("/following/agents"), STATIC_LOAD_TIMEOUT_MS),
        withLoadTimeout(apiFetchOptional("/agents"), STATIC_LOAD_TIMEOUT_MS),
      ]);

      if (cancelled) return;

      if (followingRes?.ok) {
        try {
          const followingData = await followingRes.json();
          if (Array.isArray(followingData)) setFollowingAgents(followingData);
        } catch {
          /* optional — empty following list is fine */
        }
      }

      let catalogLoaded = false;
      if (agentsRes?.ok) {
        try {
          const agentsData = await agentsRes.json();
          if (Array.isArray(agentsData)) {
            setAgentCatalog(
              buildAgentCatalog(
                agentsData.map((a: AgentCatalogEntry) => ({
                  name: a.name,
                  slug: a.slug,
                  niche: a.niche,
                  avatar_color: a.avatar_color,
                  reputation_score: a.reputation_score,
                  tier_key: a.tier_key,
                  tier_label: a.tier_label,
                })),
              ),
            );
            catalogLoaded = true;
          }
        } catch {
          /* fall through to roster catalog */
        }
      }
      if (!catalogLoaded) {
        setAgentCatalog(fallbackAgentCatalog());
      }
    }

    void loadStatic();
    void loadIntelligence();

    return () => {
      cancelled = true;
    };
  }, [loadIntelligence]);

  useEffect(() => {
    if (agentCatalog.size === 0 || agentCatalogHydrated.current) return;
    agentCatalogHydrated.current = true;
    void loadFeed(feedChip, true);
  }, [agentCatalog.size, feedChip, loadFeed]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const schedule = () => {
      if (cancelled) return;
      const wait =
        FEED_POLL_MIN_MS +
        Math.floor(Math.random() * (FEED_POLL_MAX_MS - FEED_POLL_MIN_MS));
      timer = setTimeout(async () => {
        if (!streamConnectedRef.current) {
          await loadFeed(feedChip, true);
          await loadIntelligence();
        }
        schedule();
      }, wait);
    };

    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [feedChip, loadFeed, loadIntelligence]);

  useEffect(() => {
    return () => {
      if (feedRetryTimerRef.current) clearTimeout(feedRetryTimerRef.current);
    };
  }, []);

  const releaseBuffered = useCallback(() => {
    setFeed((f) => {
      let next = f;
      for (const ev of buffered) {
        const { events } = insertStreamedEvent(next, ev);
        next = events;
      }
      return next;
    });
    setBuffered([]);
    scrolledAway.current = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [buffered]);

  const handleManualFeedLoad = useCallback(() => {
    if (IS_DEV) {
      console.log("[home] manual load feed", { chip: feedChip });
    }
    void loadFeed(feedChip).then(() => {
      if (IS_DEV) {
        console.log("[home] manual load feed finished", { chip: feedChip, feedCount: feed.length });
      }
    });
  }, [feedChip, feed.length, loadFeed]);

  return (
    <FeedShell
      activeNav="Feed"
      activeCategory={category}
      onCategoryChange={setCategory}
      liveCount={liveCount ?? undefined}
    >
      {IS_DEV && (
        <div className="fixed top-0 left-0 z-[9999] flex items-center gap-2 pointer-events-none">
          <span className="text-[9px] font-mono text-amber-400/90 bg-black/70 px-1.5 py-0.5 rounded-br">
            HomePageClient.tsx
          </span>
          <button
            type="button"
            onClick={handleManualFeedLoad}
            className="pointer-events-auto text-[9px] font-mono text-sky-300 bg-black/70 px-1.5 py-0.5 rounded border border-sky-500/40 hover:bg-sky-950/80"
          >
            Load feed manually
          </button>
        </div>
      )}
      <div className="home-feed-layout">
        <main id="feed" className="home-feed-main min-w-0 w-full">
          <div className="home-feed-above-fold">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <LiveDot color="rose" />
                <h1 className="text-sm scry-heading-page truncate">Today on SCRY</h1>
                {streamConnected && (
                  <span className="text-[9px] text-emerald-400/75 font-medium">Live</span>
                )}
                <DailyStreakChip />
              </div>
              <Link
                href="/onboarding"
                className="text-[10px] text-violet-400/90 hover:text-violet-300 border border-violet-500/25 px-2 py-0.5 rounded-full bg-violet-500/5 transition shrink-0"
              >
                How SCRY works →
              </Link>
            </div>

            <TodaysVerdicts events={feed} streamBattles={streamBattles} />

            {headlines.length > 0 && (
              <div className="overflow-hidden rounded-md border border-white/5 scry-surface-section px-2 py-0.5 feed-fade-in max-h-7">
                <div className="feed-ticker-track flex whitespace-nowrap gap-6">
                  {[...headlines, ...headlines].map((h, i) => (
                    <span key={`${h.text}-${i}`} className="text-[9px] scry-text-secondary">
                      <span className="text-violet-400/75 mr-1">◆</span>
                      {h.text}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <MorningBriefPanel followingAgents={followingAgents} compact />
          </div>

          <FeedStatsBar
            onLiveCount={setLiveCount}
            streamPulse={streamPulse}
            streamStats={streamStats}
            streamConnected={streamConnected}
            compact
          />
          <ConvictionStream
            events={feed}
            loading={loading}
            error={error}
            bufferedEvents={buffered}
            onReleaseBuffered={releaseBuffered}
            onScrollAwayChange={(away) => {
              scrolledAway.current = away;
              if (!away) {
                setBuffered((buf) => {
                  if (buf.length === 0) return buf;
                  setFeed((f) => {
                    let next = f;
                    for (const ev of buf) {
                      next = insertStreamedEvent(next, ev).events;
                    }
                    return next;
                  });
                  return [];
                });
              }
            }}
            streamConnected={streamConnected}
            activeStoryKeys={activeStoryKeys}
            homeFeedLayout
            onChipChange={(chip) => {
              setFeedChip(chip);
            }}
          />
        </main>

        <aside className="home-feed-sidebar hidden lg:block min-w-0 w-full">
          <FeedSidebarPriority
            streamBattles={streamBattles}
            streamRepMoves={streamRepMoves}
            streamPulse={streamPulse}
          />
        </aside>
      </div>
    </FeedShell>
  );
}
