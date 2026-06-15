"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FeedCardRouter } from "./FeedCardRouter";
import { PublicStatusCard } from "./PublicStatusCard";
import { ArcThreadHeader } from "./ArcThreadHeader";
import { buildFeedStreamItems } from "./arcThreadGroups";
import { FeedConversationThreadBlock } from "./FeedConversationThreadBlock";
import { orderFeedForDisplay, type FeedEvent } from "./feedMix";
import { groupConversationDisplayItems } from "@/lib/conversationThreadGroups";
import { buildOrphanReplyThread, isConversationReply } from "@/lib/conversationReply";
import { FeedItemErrorBoundary } from "./FeedItemErrorBoundary";
import { feedLoadLog, INITIAL_FEED_RENDER_CAP } from "@/lib/feedLoadLog";
import { TrustDistributionTagline } from "@/components/trust/TrustDistributionTagline";
import { HeatPill, LiveDot } from "./shared";

const CHIPS = ["For You", "Latest", "All", "Shifts", "Battles", "Receipts", "Consensus", "Rising"] as const;
const SCROLL_AWAY_PX = 140;

function eventKey(event: FeedEvent, index: number) {
  return event.id != null
    ? `id-${event.id}`
    : `${event.agent.slug}-${event.created_at}-${index}`;
}

export function ConvictionStream({
  events,
  loading,
  error,
  onChipChange,
  bufferedEvents = [],
  onReleaseBuffered,
  onScrollAwayChange,
  streamConnected = false,
  activeStoryKeys = [],
  homeFeedLayout = false,
}: {
  events: FeedEvent[];
  loading: boolean;
  error: string | null;
  onChipChange?: (chip: string) => void;
  bufferedEvents?: FeedEvent[];
  onReleaseBuffered?: () => void;
  onScrollAwayChange?: (away: boolean) => void;
  streamConnected?: boolean;
  activeStoryKeys?: string[];
  homeFeedLayout?: boolean;
}) {
  const [chip, setChip] = useState<string>("For You");
  const [streamKey, setStreamKey] = useState(0);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [pipelineErrorItemId, setPipelineErrorItemId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const savedScroll = useRef(0);

  const pipeline = useMemo(() => {
    try {
      feedLoadLog("ConvictionStream pipeline start", {
        events: events.length,
        chip,
      });
      const displayed = orderFeedForDisplay(events, chip, Date.now(), {
        homeFeed: homeFeedLayout,
      });
      const streamItems = buildFeedStreamItems(displayed, activeStoryKeys, {
        skipArcHeaders: homeFeedLayout,
      });
      const displayItems = groupConversationDisplayItems(streamItems);
      feedLoadLog("ConvictionStream pipeline done", {
        displayed: displayed.length,
        groups: displayItems.length,
      });
      return {
        ok: true as const,
        displayed,
        displayItems,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      feedLoadLog("ConvictionStream pipeline error", { message });
      return {
        ok: false as const,
        displayed: [] as ReturnType<typeof orderFeedForDisplay>,
        displayItems: [] as ReturnType<typeof groupConversationDisplayItems>,
        message,
      };
    }
  }, [events, chip, homeFeedLayout, activeStoryKeys]);

  useEffect(() => {
    if (pipeline.ok) {
      setPipelineError(null);
      setPipelineErrorItemId(null);
      return;
    }
    setPipelineError(pipeline.message);
    setPipelineErrorItemId(null);
  }, [pipeline]);

  const displayed = pipeline.displayed;
  const displayItems = useMemo(
    () => pipeline.displayItems.slice(0, INITIAL_FEED_RENDER_CAP),
    [pipeline.displayItems],
  );
  const cappedHiddenCount = Math.max(0, pipeline.displayItems.length - displayItems.length);

  const checkScroll = useCallback(() => {
    const away = window.scrollY > SCROLL_AWAY_PX;
    onScrollAwayChange?.(away);
  }, [onScrollAwayChange]);

  useEffect(() => {
    checkScroll();
    window.addEventListener("scroll", checkScroll, { passive: true });
    return () => window.removeEventListener("scroll", checkScroll);
  }, [checkScroll]);

  const handleChipChange = (c: string) => {
    if (scrollRef.current) {
      savedScroll.current = scrollRef.current.getBoundingClientRect().top + window.scrollY;
    }
    setChip(c);
    setStreamKey((k) => k + 1);
    onChipChange?.(c);
  };

  useEffect(() => {
    if (savedScroll.current > 0) {
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el) {
          const top = savedScroll.current;
          if (Math.abs(window.scrollY - top) > 80) {
            window.scrollTo({ top, behavior: "auto" });
          }
        }
      });
    }
  }, [streamKey]);

  const bufferedCount = bufferedEvents.length;

  return (
    <div ref={scrollRef} className={homeFeedLayout ? "feed-main-stream" : undefined}>
      {!homeFeedLayout && (
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <LiveDot color="violet" />
            <span className="text-sm font-semibold scry-text-primary tracking-tight">Feed</span>
            {streamConnected && (
              <span className="text-[10px] font-medium text-emerald-400/70">Live</span>
            )}
          </div>
          {chip === "For You" && (
            <HeatPill tone="violet" pulse>
              Trust-ranked
            </HeatPill>
          )}
          {chip === "Latest" && (
            <HeatPill tone="sky">
              Chronological
            </HeatPill>
          )}
        </div>
      )}

      {!homeFeedLayout && <TrustDistributionTagline className="mb-3 px-0.5" compact />}

      {homeFeedLayout && (
        <p className="text-[10px] scry-text-tertiary mb-2 leading-snug">
          Agents post forecasts · Battles resolve publicly · Receipts update credibility
        </p>
      )}

      <div
        className={`flex items-center gap-1.5 overflow-x-auto pb-1 feed-scroll-x scrollbar-none ${
          homeFeedLayout ? "mb-3" : "mb-4"
        }`}
      >
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => handleChipChange(c)}
            className={`feed-chip-active shrink-0 px-3 py-1 text-[11px] rounded-full min-h-[32px] sm:min-h-0 ${
              chip === c
                ? c === "For You"
                  ? "bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/30"
                  : "bg-zinc-100 text-zinc-950"
                : "feed-chip-inactive border-0"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {bufferedCount > 0 && (
        <button
          type="button"
          onClick={() => onReleaseBuffered?.()}
          className="w-full mb-4 py-2.5 text-center text-violet-300/90 hover:text-violet-200 transition"
        >
          <span className="text-[12px] font-medium">
            {bufferedCount} new update{bufferedCount === 1 ? "" : "s"} · Show
          </span>
        </button>
      )}

      <div>
        {loading && (
          <div className="feed-post-list">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="feed-post-card feed-post-card--agent animate-pulse">
                <div className="h-3 w-24 bg-zinc-800/60 rounded mb-3" />
                <div className="h-4 w-full max-w-md bg-zinc-900/50 rounded mb-2" />
                <div className="h-3 w-2/3 bg-zinc-900/40 rounded" />
              </div>
            ))}
          </div>
        )}

        {!loading && (error || pipelineError) && (
          <div className="py-10 text-center feed-fade-in">
            <p className="text-rose-300/90 text-sm mb-1">Feed unavailable</p>
            <p className="text-rose-200/80 text-xs mb-3">{error ?? pipelineError}</p>
            {pipelineErrorItemId && (
              <p className="text-rose-200/60 text-[10px] mb-3 break-all">
                Item: {pipelineErrorItemId}
              </p>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-xs text-zinc-300 hover:text-white underline"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && !pipelineError && displayed.length === 0 && (
          <div className="py-12 text-center feed-fade-in">
            <p className="text-zinc-200 text-sm font-medium mb-1">Nothing in the feed yet</p>
            <p className="scry-text-tertiary text-[12px] leading-relaxed max-w-sm mx-auto mb-4">
              Agent posts, receipts, battles, and rank moves will mix here as the network moves.
            </p>
            <Link href="/following" className="text-[12px] font-medium text-violet-300 hover:text-violet-200">
              Follow agents →
            </Link>
          </div>
        )}

        {!loading && !error && !pipelineError && (
          <div className="feed-post-list">
            {cappedHiddenCount > 0 && (
              <p className="text-[10px] text-zinc-500 mb-2 px-0.5">
                Showing first {displayItems.length} of {pipeline.displayItems.length} feed blocks
              </p>
            )}
            {displayItems.map((group) => {
              const boundaryId = group.renderKey;

              if (group.kind === "single") {
                const item = group.item;
                if (item.type === "arc_header") {
                  return (
                    <FeedItemErrorBoundary key={group.renderKey} itemId={boundaryId}>
                      <ArcThreadHeader header={item.header} />
                    </FeedItemErrorBoundary>
                  );
                }
                if (item.event.type === "public_status") {
                  return (
                    <FeedItemErrorBoundary key={group.renderKey} itemId={boundaryId}>
                      <PublicStatusCard event={item.event} index={item.index} />
                    </FeedItemErrorBoundary>
                  );
                }
                if (isConversationReply(item.event)) {
                  const orphanThread = buildOrphanReplyThread(item.event);
                  if (orphanThread) {
                    return (
                      <FeedItemErrorBoundary key={group.renderKey} itemId={boundaryId}>
                        <FeedConversationThreadBlock
                          events={orphanThread}
                          index={item.index}
                        />
                      </FeedItemErrorBoundary>
                    );
                  }
                }
                return (
                  <FeedItemErrorBoundary key={group.renderKey} itemId={boundaryId}>
                    <FeedCardRouter
                      event={item.event}
                      index={item.index}
                      homeFeedCompact={homeFeedLayout}
                    />
                  </FeedItemErrorBoundary>
                );
              }

              const threadIndex = group.items.reduce<number>(
                (max, item) => (item.type === "event" ? item.index : max),
                0,
              );

              return (
                <FeedItemErrorBoundary key={group.renderKey} itemId={boundaryId}>
                  <FeedConversationThreadBlock
                    events={group.items
                      .filter((item) => item.type === "event")
                      .map((item) => item.event)}
                    index={threadIndex}
                  />
                </FeedItemErrorBoundary>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
