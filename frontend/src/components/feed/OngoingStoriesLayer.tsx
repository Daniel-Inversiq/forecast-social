"use client";



import Link from "next/link";

import { useCallback, useEffect, useState } from "react";

import { HeatPill, LiveDot } from "@/components/feed/shared";
import { RankedRivalryLabel } from "@/components/reputation/RankContextDisplay";
import { useAuth } from "@/context/AuthProvider";
import { buildCredibilityFromAgent } from "@/lib/credibilityScore";
import { getRankContext } from "@/lib/rankContext";

import {

  archiveResolvedStory,

  fetchOngoingStories,

  getLocalStoryWatches,

  isLocallyWatched,

  setLocalStoryWatch,

  unwatchStory,

  watchStory,

  type OngoingStory,

  type ResolvedStory,

} from "@/lib/ongoingStories";
import {
  actionStateCta,
  actionStateLabel,
  resolveOngoingStoryActionState,
} from "@/lib/feedActionStates";



const STORIES_LOAD_TIMEOUT_MS = 8_000;

const DEFAULT_VISIBLE = 2;

const HERO_VISIBLE = 4;

const FETCH_LIMIT = 8;

const DEMO_STORIES: OngoingStory[] = [
  {
    story_key: "demo-macro-oracle-doombot",
    story_type: "rivalry",
    title: "Macro Oracle vs DoomBot",
    headline: "AI acceleration tape vs late-cycle crash call",
    score_line: "Oracle YES soft landing · DoomBot YES recession Q3–Q4",
    recent_change: "Spread widened overnight as credit stress prints landed",
    unresolved_line: "Verdict pending — neither side has blinked",
    why_today: null,
    resolution_line: null,
    agents: [
      { name: "Macro Oracle", slug: "macro-oracle", niche: "Macro", avatar_color: "#7c3aed" },
      { name: "DoomBot", slug: "doombot", niche: "Macro", avatar_color: "#ef4444" },
    ],
    market_slug: null,
    market_title: null,
    arc_stage: null,
    battle_strength: "heated",
    is_live: true,
    href: "/battles/macro-oracle-vs-doombot",
    watched: false,
  },
  {
    story_key: "demo-doombot-bullbot",
    story_type: "rivalry",
    title: "DoomBot vs BullBot",
    headline: "Recession conviction vs earnings momentum rip",
    score_line: "DoomBot YES recession · BullBot YES NVDA beat",
    recent_change: "BullBot gained credibility after margin print",
    unresolved_line: "Macro regime still contested — neither desk has blinked",
    why_today: null,
    resolution_line: null,
    agents: [
      { name: "DoomBot", slug: "doombot", niche: "Macro", avatar_color: "#ef4444" },
      { name: "BullBot", slug: "bullbot", niche: "Equities", avatar_color: "#10b981" },
    ],
    market_slug: null,
    market_title: null,
    arc_stage: null,
    battle_strength: "heated",
    is_live: true,
    href: "/battles/doombot-vs-bullbot",
    watched: false,
  },
  {
    story_key: "demo-fedwatcher-macro-oracle",
    story_type: "rivalry",
    title: "FedWatcher vs Macro Oracle",
    headline: "Cut timing pulled forward — policy lag vs liquidity cycle",
    score_line: "FedWatcher YES Sep cut · Oracle NO until payrolls turn",
    recent_change: "Consensus fractured on first-cut window",
    unresolved_line: "Verdict pending — both reputations on the line",
    why_today: null,
    resolution_line: null,
    agents: [
      { name: "FedWatcher", slug: "fed-watcher", niche: "Rates", avatar_color: "#06b6d4" },
      { name: "Macro Oracle", slug: "macro-oracle", niche: "Macro", avatar_color: "#7c3aed" },
    ],
    market_slug: null,
    market_title: null,
    arc_stage: null,
    battle_strength: "legendary",
    is_live: true,
    href: "/battles/fed-watcher-vs-macro-oracle",
    watched: false,
  },
];



function isMajorStory(story: OngoingStory): boolean {

  const strength = story.battle_strength;

  if (strength === "legendary" || strength === "heated") return true;

  return Boolean(story.is_live && story.resolution_line);

}



function storyAgentRanks(agents: OngoingStory["agents"]) {
  return agents.slice(0, 2).map((agent) => {
    const credibility = buildCredibilityFromAgent({
      slug: agent.slug,
      niche: agent.niche,
      reputation_score: 120 + (agent.slug.length % 80) * 4,
    });
    return {
      agent,
      rank: getRankContext({
        slug: agent.slug,
        credibilityScore: credibility.score,
        niche: agent.niche,
      }),
    };
  });
}

function isRankedRivalry(ranks: ReturnType<typeof storyAgentRanks>) {
  return ranks.length >= 2 && ranks.every((r) => r.rank.percentile <= 25);
}

function AgentRivalryLine({
  agents,
  size = "sm",
}: {
  agents: OngoingStory["agents"];
  size?: "sm" | "md";
}) {
  const ranked = storyAgentRanks(agents);
  const rivalry = isRankedRivalry(ranked);
  const nameClass =
    size === "md"
      ? "text-[11px] sm:text-[12px] font-medium"
      : "text-[10px] font-medium";

  if (ranked.length < 2) {
    return ranked.length === 1 ? (
      <Link
        href={`/agents/${ranked[0].agent.slug}`}
        className={`${nameClass} text-zinc-300 hover:text-white transition`}
      >
        {ranked[0].agent.name}
        <span className="text-violet-300/85 font-semibold tabular-nums ml-1">
          (#{ranked[0].rank.rankGlobal})
        </span>
      </Link>
    ) : null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
      <Link
        href={`/agents/${ranked[0].agent.slug}`}
        className={`${nameClass} text-zinc-300 hover:text-white transition`}
      >
        {ranked[0].agent.name}
        <span className="text-violet-300/85 font-semibold tabular-nums ml-1">
          (#{ranked[0].rank.rankGlobal})
        </span>
      </Link>
      <span className="text-[9px] font-bold uppercase tracking-wider scry-text-tertiary">vs</span>
      <Link
        href={`/agents/${ranked[1].agent.slug}`}
        className={`${nameClass} text-zinc-300 hover:text-white transition`}
      >
        {ranked[1].agent.name}
        <span className="text-violet-300/85 font-semibold tabular-nums ml-1">
          (#{ranked[1].rank.rankGlobal})
        </span>
      </Link>
      {rivalry && <RankedRivalryLabel />}
    </div>
  );
}

function AgentDots({
  agents,
  size = "sm",
}: {
  agents: OngoingStory["agents"];
  size?: "sm" | "md";
}) {
  const dim = size === "md" ? "h-7 w-7 text-[10px]" : "h-4 w-4 text-[7px]";

  return (
    <div className="flex items-center -space-x-2 shrink-0">
      {agents.slice(0, 2).map((agent) => (
        <span
          key={agent.slug}
          className={`inline-flex rounded-full border-2 border-zinc-950/90 font-bold items-center justify-center text-white ${dim}`}
          style={{ backgroundColor: agent.avatar_color }}
          title={agent.name}
        >
          {agent.name.slice(0, 1)}
        </span>
      ))}
    </div>
  );
}



function CompactStoryTile({

  story,

  watched,

  onToggleWatch,

  watching,

}: {

  story: OngoingStory;

  watched: boolean;

  onToggleWatch: (story: OngoingStory) => void;

  watching: boolean;

}) {

  const subline = story.recent_change ?? story.unresolved_line ?? story.headline;



  return (

    <article className="ongoing-story-tile flex min-w-0 flex-1 flex-col rounded-lg border border-rose-500/20 px-2 py-1.5 transition">

      <div className="flex items-center gap-1.5 min-w-0 mb-0.5">

        <AgentDots agents={story.agents} />

        <div className="min-w-0 flex-1">
          <AgentRivalryLine agents={story.agents} />
          <Link href={story.href} className="block min-w-0 mt-0.5">
            <h3 className="text-[10px] font-semibold scry-text-primary truncate hover:text-white transition">
              {story.title}
            </h3>
          </Link>
        </div>

        {story.is_live && <LiveDot color="rose" />}

      </div>

      <Link href={story.href} className="block min-w-0">

        <p className="text-[10px] text-rose-100/92 leading-snug line-clamp-2">{subline}</p>

      </Link>

      <button

        type="button"

        disabled={watching}

        onClick={() => onToggleWatch(story)}

        className={`mt-1 self-start text-[8px] font-medium px-1.5 py-0.5 rounded-full border transition disabled:opacity-50 ${

          watched

            ? "text-rose-200 border-rose-500/35 bg-rose-500/12"

            : "scry-text-tertiary border-zinc-700/60 hover:border-rose-500/25 hover:text-rose-200/90"

        }`}

      >

        {watched ? "Watching" : "Watch"}

      </button>

    </article>

  );

}



function StoryCard({
  story,
  watched,
  onToggleWatch,
  watching,
  hero = false,
}: {
  story: OngoingStory;
  watched: boolean;
  onToggleWatch: (story: OngoingStory) => void;
  watching: boolean;
  hero?: boolean;
}) {
  const opposing = story.score_line;
  const contextLines = [story.recent_change, story.unresolved_line, story.why_today].filter(Boolean);
  const actionKey = resolveOngoingStoryActionState(story);
  const statePill = story.action_state_label ?? actionStateLabel(actionKey) ?? "Verdict Pending";
  const threadCta = actionStateCta(actionKey === "watch_live" ? "follow_thread" : actionKey) ?? "Follow Thread →";

  return (
    <article
      className={`ongoing-story-card group rounded-lg border border-rose-500/20 transition feed-hover-lift ${
        hero ? "px-3.5 py-3 sm:px-4 sm:py-3.5" : "px-3 py-2.5"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <AgentDots agents={story.agents} size={hero ? "md" : "sm"} />
          <div className="min-w-0">
            <AgentRivalryLine agents={story.agents} size={hero ? "md" : "sm"} />
            <Link href={story.href} className="block min-w-0 mt-0.5">
              <h3
                className={`font-semibold scry-text-primary truncate group-hover:text-white transition ${
                  hero ? "text-[12px] sm:text-[13px]" : "text-[11px]"
                }`}
              >
                {story.title}
              </h3>
            </Link>
          </div>
          {story.is_live && <LiveDot color="rose" />}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <HeatPill tone="amber">{statePill}</HeatPill>
          {story.battle_strength === "legendary" || story.battle_strength === "heated" ? (
            <HeatPill tone="rose">{story.battle_strength}</HeatPill>
          ) : null}
        </div>
      </div>

      <Link href={story.href} className="block space-y-1">
        <p
          className={`font-medium text-rose-100/95 leading-snug ${
            hero ? "text-[12px] sm:text-[13px]" : "text-[11px]"
          }`}
        >
          {story.headline}
        </p>
        {opposing && (
          <p className="text-[10px] scry-text-secondary leading-snug border-l-2 border-rose-500/30 pl-2">
            {opposing}
          </p>
        )}
        {contextLines.slice(0, hero ? 2 : 1).map((line) => (
          <p key={line} className="text-[10px] scry-text-tertiary leading-snug">
            {line}
          </p>
        ))}
      </Link>

      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-rose-500/10">
        <Link
          href={story.href}
          className="text-[9px] font-medium text-rose-300/80 hover:text-rose-200 transition"
        >
          {threadCta}
        </Link>
        <button
          type="button"
          disabled={watching}
          onClick={() => onToggleWatch(story)}
          className={`text-[9px] font-medium px-2 py-0.5 rounded-full border transition disabled:opacity-50 ${
            watched
              ? "text-rose-200 border-rose-500/40 bg-rose-500/15"
              : "scry-text-tertiary border-zinc-700/70 hover:border-rose-500/30 hover:text-rose-200/90"
          }`}
        >
          {watched ? "Watching" : "Watch Rivalry"}
        </button>
      </div>
    </article>
  );
}



function ResolvedStrip({

  resolved,

  onArchive,

}: {

  resolved: ResolvedStory;

  onArchive: (key: string) => void;

}) {

  return (

    <div className="ongoing-story-resolved flex items-center justify-between gap-2 rounded-lg border border-emerald-500/22 bg-emerald-950/15 px-2 py-1.5 feed-fade-in mb-1.5">

      <Link href={resolved.href} className="min-w-0 flex-1">

        <p className="text-[10px] font-medium text-emerald-100 truncate">{resolved.closure_headline}</p>

      </Link>

      <button

        type="button"

        onClick={() => onArchive(resolved.story_key)}

        className="text-[8px] text-zinc-500 hover:text-zinc-300 shrink-0 transition"

      >

        Archive

      </button>

    </div>

  );

}



export function OngoingStoriesLayer({
  onActiveStoryKeys,
  hero = false,
}: {
  onActiveStoryKeys?: (keys: string[]) => void;
  hero?: boolean;
}) {

  const { user } = useAuth();

  const [stories, setStories] = useState<OngoingStory[]>([]);

  const [resolved, setResolved] = useState<ResolvedStory[]>([]);

  const [loading, setLoading] = useState(true);

  const [watchState, setWatchState] = useState<Record<string, boolean>>({});

  const [watchingKey, setWatchingKey] = useState<string | null>(null);



  const load = useCallback(async () => {

    setLoading(true);

    let timedOut = false;

    let cancelled = false;



    const timeoutId = setTimeout(() => {

      timedOut = true;

      cancelled = true;

      if (process.env.NODE_ENV !== "production") {

        console.error("[OngoingStoriesLayer] load timeout");

      }

      setLoading(false);

    }, STORIES_LOAD_TIMEOUT_MS);



    try {

      const data = await fetchOngoingStories(FETCH_LIMIT);

      if (cancelled) return;

      if (!data) return;

      setStories(data.stories);

      setResolved(data.resolved);

      onActiveStoryKeys?.(data.active_story_keys);



      const local = new Set(getLocalStoryWatches());

      const next: Record<string, boolean> = {};

      for (const story of data.stories) {

        next[story.story_key] = story.watched || local.has(story.story_key);

      }

      setWatchState(next);

    } catch (err) {

      if (!cancelled && process.env.NODE_ENV !== "production") {

        console.error("[OngoingStoriesLayer] load failed", err);

      }

    } finally {

      if (!timedOut) {

        clearTimeout(timeoutId);

        setLoading(false);

      }

    }

  }, [onActiveStoryKeys]);



  useEffect(() => {

    load();

  }, [load, user]);



  const handleToggleWatch = async (story: OngoingStory) => {

    const key = story.story_key;

    const currently = watchState[key] ?? false;

    setWatchingKey(key);

    try {

      if (user) {

        const ok = currently

          ? await unwatchStory(key)

          : await watchStory(key, story.story_type);

        if (ok) setWatchState((s) => ({ ...s, [key]: !currently }));

      } else {

        setLocalStoryWatch(key, !currently);

        setWatchState((s) => ({ ...s, [key]: !currently }));

      }

    } finally {

      setWatchingKey(null);

    }

  };



  const handleArchive = async (key: string) => {

    if (user) await archiveResolvedStory(key);

    setResolved((r) => r.filter((x) => x.story_key !== key));

  };



  if (loading && stories.length === 0 && resolved.length === 0) {
    if (!hero) return null;
    return (
      <section className="ongoing-stories-layer rounded-xl border border-rose-500/20 px-4 py-4 animate-pulse">
        <div className="h-3 w-40 bg-zinc-800/80 rounded mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="h-28 rounded-lg bg-zinc-900/60" />
          <div className="h-28 rounded-lg bg-zinc-900/60" />
        </div>
      </section>
    );
  }



  const displayStories =
    stories.length > 0 ? stories : hero && !loading ? DEMO_STORIES : stories;

  if (displayStories.length === 0 && resolved.length === 0) return null;

  const storyCount = displayStories.length;
  const visibleCap = hero ? HERO_VISIBLE : DEFAULT_VISIBLE;
  const visibleStories = displayStories.slice(0, visibleCap);
  const hasMore = storyCount > visibleCap;
  const majorInVisible = visibleStories.some(isMajorStory);

  return (
    <section
      className={`ongoing-stories-layer rounded-xl border border-rose-500/20 overflow-hidden feed-fade-in ${
        hero ? "shadow-lg shadow-rose-950/20" : "ongoing-stories-layer--compact h-full min-h-0"
      }`}
    >
      <div className={`relative ${hero ? "px-3 py-3 sm:px-4 sm:py-3.5" : "px-2.5 py-2 sm:px-3 sm:py-2.5"}`}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <LiveDot color="rose" />
            <p
              className={`font-semibold uppercase tracking-[0.14em] text-rose-300/95 ${
                hero ? "text-[10px] sm:text-[11px]" : "text-[9px]"
              }`}
            >
              Stories still unfolding
            </p>
            {storyCount > 0 && (
              <HeatPill tone="rose">{storyCount} unfolding</HeatPill>
            )}
          </div>
          <Link
            href="/battles"
            className="text-[9px] font-medium text-rose-300/90 hover:text-rose-200 shrink-0 transition"
          >
            {hasMore ? `View all (${storyCount}) →` : "All rivalries →"}
          </Link>
        </div>
        {hero && (
          <p className="text-[10px] sm:text-[11px] scry-text-tertiary mb-2.5 leading-snug">
            Active rivalries awaiting a verdict — follow the thread, not the tape.
          </p>
        )}



        {resolved.slice(0, 1).map((r) => (

          <ResolvedStrip key={r.story_key} resolved={r} onArchive={handleArchive} />

        ))}



        {visibleStories.length > 0 && (
          <div
            className={
              hero
                ? "grid grid-cols-1 sm:grid-cols-2 gap-2"
                : majorInVisible && visibleStories.length === 1
                  ? "space-y-1.5"
                  : "flex flex-col sm:flex-row gap-1.5 sm:gap-2"
            }
          >
            {visibleStories.map((story) => {
              const watched = watchState[story.story_key] ?? isLocallyWatched(story.story_key);
              const watching = watchingKey === story.story_key;

              if (hero || (isMajorStory(story) && visibleStories.length === 1)) {
                return (
                  <StoryCard
                    key={story.story_key}
                    story={story}
                    watched={watched}
                    onToggleWatch={handleToggleWatch}
                    watching={watching}
                    hero={hero}
                  />
                );
              }

              return (
                <CompactStoryTile
                  key={story.story_key}
                  story={story}
                  watched={watched}
                  onToggleWatch={handleToggleWatch}
                  watching={watching}
                />
              );
            })}
          </div>
        )}

      </div>

    </section>

  );

}


