"use client";

import type { FeedInteractionRecord } from "@/lib/feedInteractions";
import type { MarketThreadPost } from "@/lib/marketThread";
import {
  hasFeedBacks,
  hasFeedChallenges,
  hasFeedReads,
} from "@/lib/profileSectionState";

type FeedReadsBlock = {
  recent_backs: FeedInteractionRecord[];
  recent_challenges: FeedInteractionRecord[];
  recent_thread_posts?: MarketThreadPost[];
  back_count: number;
  challenge_count: number;
};

function ReadRow({ item, tone }: { item: FeedInteractionRecord; tone: "back" | "challenge" }) {
  const event = (item as FeedInteractionRecord & { feed_event?: { title?: string; agent_slug?: string } })
    .feed_event;
  const accent = tone === "challenge" ? "text-rose-200/85" : "text-emerald-200/80";

  return (
    <li className={`text-[11px] leading-snug ${accent}`}>
      <span className="capitalize">{tone}</span>
      {item.user_probability != null && (
        <span className="text-zinc-500"> · {Math.round(item.user_probability)}%</span>
      )}
      {item.thesis_text && (
        <span className="text-zinc-500 block mt-0.5 line-clamp-2">&ldquo;{item.thesis_text}&rdquo;</span>
      )}
      {event?.title && (
        <span className="text-zinc-600 block mt-0.5 truncate">{event.title}</span>
      )}
    </li>
  );
}

export function UserPublicReads({ feedReads }: { feedReads?: FeedReadsBlock | null }) {
  if (!hasFeedReads(feedReads)) {
    return null;
  }

  const {
    recent_backs,
    recent_challenges,
    recent_thread_posts = [],
    back_count,
    challenge_count,
  } = feedReads!;

  const showBacks = hasFeedBacks(feedReads);
  const showChallenges = hasFeedChallenges(feedReads);
  const showThreadPosts = recent_thread_posts.length > 0;

  return (
    <div className="rounded-xl border border-zinc-800/85 bg-zinc-950/90 p-4 feed-hover-lift">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[9px] uppercase tracking-wider text-zinc-600">Public conviction archive</p>
        <p className="text-[9px] text-zinc-600 tabular-nums">
          {back_count} backed · {challenge_count} challenged
        </p>
      </div>
      {showThreadPosts && (
        <div className="mb-4">
          <p className="text-[9px] text-zinc-600 mb-1.5">Recent market thread posts</p>
          <ul className="space-y-2">
            {recent_thread_posts.slice(0, 3).map((post) => (
              <li key={post.id} className="text-[11px] text-zinc-400 leading-snug">
                <span className="text-violet-200/80 capitalize">{post.post_type.replace("-", " ")}</span>
                {post.user_probability != null && (
                  <span className="text-zinc-600"> · {Math.round(post.user_probability)}%</span>
                )}
                <span className="text-zinc-500 block line-clamp-2 mt-0.5">{post.body}</span>
                {post.market?.title && (
                  <span className="text-zinc-700 text-[10px]">{post.market.title}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {(showBacks || showChallenges) && (
        <div
          className={
            showBacks && showChallenges
              ? "grid grid-cols-1 sm:grid-cols-2 gap-4"
              : "space-y-2"
          }
        >
          {showBacks && (
            <div>
              <p className="text-[9px] text-zinc-600 mb-1.5">Recent backs</p>
              {recent_backs.length > 0 ? (
                <ul className="space-y-2">
                  {recent_backs.slice(0, 4).map((item) => (
                    <ReadRow key={item.id} item={item} tone="back" />
                  ))}
                </ul>
              ) : (
                <p className="text-[10px] text-zinc-500 tabular-nums">{back_count} on record</p>
              )}
            </div>
          )}
          {showChallenges && (
            <div>
              <p className="text-[9px] text-zinc-600 mb-1.5">Recent challenges</p>
              {recent_challenges.length > 0 ? (
                <ul className="space-y-2">
                  {recent_challenges.slice(0, 4).map((item) => (
                    <ReadRow key={item.id} item={item} tone="challenge" />
                  ))}
                </ul>
              ) : (
                <p className="text-[10px] text-zinc-500 tabular-nums">{challenge_count} on record</p>
              )}
            </div>
          )}
        </div>
      )}
      <p className="text-[9px] text-zinc-700 mt-3">
        Challenge accuracy and conviction scoring ship later — reads are on record now.
      </p>
    </div>
  );
}
