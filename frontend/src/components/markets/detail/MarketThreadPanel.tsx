"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar, formatTimeAgo } from "@/components/feed/shared";
import { useAuth } from "@/context/AuthProvider";
import { redirectToLogin } from "@/lib/authRedirect";
import {
  fetchMarketThread,
  postMarketThread,
  MarketThreadAuthError,
  type MarketThreadPost,
  type MarketThreadResponse,
  type ThreadPostType,
  type ThreadStance,
} from "@/lib/marketThread";
import { isMarketResolved } from "@/lib/resolution";
import type { MarketDetail } from "./types";
import {
  computeArchiveHighlights,
  type ArchiveHighlight,
} from "./threadArchiveHighlights";
import { sortThreadPosts, type ThreadSortKey } from "./threadSort";

const POST_TYPES: { id: ThreadPostType; label: string; emphasis?: boolean }[] = [
  { id: "thesis", label: "Thesis" },
  { id: "counter-thesis", label: "Counter-thesis", emphasis: true },
  { id: "update", label: "Update" },
  { id: "evidence", label: "Evidence" },
  { id: "question", label: "Question" },
];

function PostRow({ post, archived }: { post: MarketThreadPost; archived: boolean }) {
  const stanceTone =
    post.stance === "yes"
      ? "text-emerald-300/90 bg-emerald-500/10 border-emerald-500/20"
      : post.stance === "no"
        ? "text-rose-300/90 bg-rose-500/10 border-rose-500/20"
        : "text-zinc-400 bg-zinc-800/50 border-zinc-700/50";

  return (
    <li className="py-3 border-b border-zinc-800/50 last:border-0">
      <div className="flex gap-3">
        <Avatar
          name={post.user.username}
          size="sm"
          color={post.user.avatar_color ?? undefined}
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
            <Link
              href={`/u/${post.user.username}`}
              className="text-sm font-medium text-white hover:text-violet-300 transition"
            >
              @{post.user.username}
            </Link>
            <span
              className={`text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${stanceTone}`}
            >
              {post.stance}
            </span>
            <span className="text-[9px] text-zinc-600 capitalize">
              {post.post_type.replace("-", " ")}
            </span>
            {post.user_probability != null && (
              <span className="text-[10px] text-zinc-500 tabular-nums font-medium">
                {Math.round(post.user_probability)}%
              </span>
            )}
            <span className="text-[10px] text-zinc-600 ml-auto">
              {formatTimeAgo(post.created_at ?? "", true)}
            </span>
          </div>
          <p className="text-[11px] text-zinc-300 leading-relaxed">{post.body}</p>
          {archived && (
            <p className="text-[9px] text-zinc-600 mt-1 uppercase tracking-wide">
              Archived read
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function ArchiveHighlightCard({ item }: { item: ArchiveHighlight }) {
  const { post } = item;
  const tone =
    item.label.includes("YES")
      ? "border-emerald-500/25 bg-emerald-950/20"
      : item.label.includes("NO")
        ? "border-rose-500/25 bg-rose-950/20"
        : "border-amber-500/25 bg-amber-950/15";

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${tone}`}>
      <p className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1">{item.label}</p>
      <p className="text-[11px] text-zinc-200 leading-snug line-clamp-3">
        <span className="text-zinc-400">@{post.user.username}</span>
        {post.user_probability != null && (
          <span className="tabular-nums text-zinc-500">
            {" "}
            · {Math.round(post.user_probability)}%
          </span>
        )}
        <span className="text-zinc-300"> — {post.body}</span>
      </p>
    </div>
  );
}

export function MarketThreadPanel({
  market,
  marketSlug,
  offline,
}: {
  market: MarketDetail;
  marketSlug: string;
  offline?: boolean;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const resolved = isMarketResolved(market);

  const [thread, setThread] = useState<MarketThreadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<ThreadSortKey>("top");
  const [body, setBody] = useState("");
  const [stance, setStance] = useState<ThreadStance>("neutral");
  const [postType, setPostType] = useState<ThreadPostType>("thesis");
  const [odds, setOdds] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCounterMode = postType === "counter-thesis";
  const oddsRequired = isCounterMode;

  const loadThread = useCallback(async () => {
    if (offline) {
      setLoading(false);
      return;
    }
    try {
      const data = await fetchMarketThread(marketSlug);
      setThread(data);
    } catch {
      setThread(null);
    } finally {
      setLoading(false);
    }
  }, [marketSlug, offline]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  const archived = thread?.archived ?? resolved;
  const canPost = thread?.can_post && !archived;

  const archiveHighlights = useMemo(() => {
    if (!archived || !thread?.posts.length) return [];
    return computeArchiveHighlights(thread.posts, market.current_yes_probability);
  }, [archived, thread?.posts, market.current_yes_probability]);

  const sortedPosts = useMemo(
    () => (thread ? sortThreadPosts(thread.posts, sortKey) : []),
    [thread, sortKey],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (trimmed.length < 8 || submitting) return;

    if (!user) {
      redirectToLogin(router, `/markets/${marketSlug}`);
      return;
    }

    const prob = odds.trim() ? Number(odds) : undefined;
    if (oddsRequired && (prob == null || prob < 1 || prob > 99)) {
      setError("Your odds are required (1–99) for a counter-thesis.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const post = await postMarketThread(marketSlug, {
        body: trimmed,
        stance,
        post_type: postType,
        user_probability: prob,
      });
      setThread((prev) =>
        prev
          ? {
              ...prev,
              post_count: prev.post_count + 1,
              posts: [post, ...prev.posts].slice(0, 40),
            }
          : prev,
      );
      setBody("");
      setOdds("");
    } catch (err) {
      if (err instanceof MarketThreadAuthError) {
        redirectToLogin(router, `/markets/${marketSlug}`);
      } else {
        setError(err instanceof Error ? err.message : "Could not publish read");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mb-4 rounded-xl border border-zinc-800/85 bg-zinc-950/90 overflow-hidden feed-hover-lift">
      <div className="px-4 py-3 border-b border-zinc-800/60 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[9px] uppercase tracking-wider text-zinc-600">Market thread</p>
          <h2 className="text-sm font-semibold text-zinc-100">Public reads on this market</h2>
          <p className="text-[10px] text-zinc-500 mt-1 leading-snug">
            Public reads close when the market resolves.
          </p>
        </div>
        {thread && (
          <span className="text-[10px] text-zinc-600 tabular-nums shrink-0">
            {thread.post_count} on record
          </span>
        )}
      </div>

      {archived && (
        <div className="px-4 py-2.5 bg-zinc-900/50 border-b border-zinc-800/50">
          <p className="text-[11px] text-amber-200/85 font-medium">Thread archived at resolution</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">
            Read-only archive. No new public reads.
          </p>
        </div>
      )}

      {archived && archiveHighlights.length > 0 && (
        <div className="px-4 py-3 border-b border-zinc-800/50 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {archiveHighlights.map((item) => (
            <ArchiveHighlightCard key={item.label} item={item} />
          ))}
        </div>
      )}

      {!archived && thread?.highlights?.top_counter && (
        <div className="px-4 py-2 border-b border-zinc-800/40 bg-rose-950/10">
          <p className="text-[9px] text-rose-400/70 uppercase tracking-wide mb-0.5">
            Leading counter-thesis
          </p>
          <p className="text-[10px] text-rose-200/85 line-clamp-2">
            @{thread.highlights.top_counter.user.username}
            {thread.highlights.top_counter.user_probability != null &&
              ` · ${Math.round(thread.highlights.top_counter.user_probability)}%`}
            : {thread.highlights.top_counter.body}
          </p>
        </div>
      )}

      {canPost && (
        <form
          onSubmit={handleSubmit}
          className={`p-4 border-b border-zinc-800/50 space-y-3 ${
            isCounterMode ? "bg-rose-950/10" : "bg-zinc-900/20"
          }`}
        >
          <p className="text-[10px] text-violet-200/75 border border-violet-500/20 bg-violet-500/8 rounded-md px-2.5 py-1.5">
            You are going on record. This is a public read, not a comment.
          </p>

          <div className="flex flex-wrap gap-1.5">
            {POST_TYPES.map((pt) => (
              <button
                key={pt.id}
                type="button"
                onClick={() => setPostType(pt.id)}
                className={`scry-tap-target text-[10px] min-h-[36px] px-2.5 py-1.5 rounded-md border transition ${
                  postType === pt.id
                    ? pt.emphasis
                      ? "border-rose-500/50 bg-rose-500/20 text-rose-100 font-medium"
                      : "border-violet-500/40 bg-violet-500/15 text-violet-200"
                    : pt.emphasis
                      ? "border-rose-900/50 text-rose-400/80 hover:border-rose-500/30"
                      : "border-zinc-700/80 text-zinc-500 hover:border-zinc-600"
                }`}
              >
                {pt.label}
              </button>
            ))}
          </div>

          {isCounterMode && (
            <p className="text-[10px] text-rose-200/80 leading-snug">
              Challenge consensus — counter-thesis requires your odds on the record.
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex gap-1.5 flex-1">
              {(["yes", "no", "neutral"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStance(s)}
                  className={`scry-tap-target flex-1 min-h-[40px] text-[10px] uppercase font-medium px-2 py-2 rounded-lg border ${
                    stance === s
                      ? s === "yes"
                        ? "border-emerald-500/40 text-emerald-200 bg-emerald-500/10"
                        : s === "no"
                          ? "border-rose-500/40 text-rose-200 bg-rose-500/10"
                          : "border-zinc-600 text-zinc-300 bg-zinc-800/50"
                      : "border-zinc-800 text-zinc-600 hover:border-zinc-600"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <label className="sm:w-36 shrink-0 block">
              <span className="text-[9px] uppercase tracking-wider text-zinc-500">
                Your odds {oddsRequired && <span className="text-rose-400">*</span>}
              </span>
              <input
                type="number"
                min={1}
                max={99}
                required={oddsRequired}
                value={odds}
                onChange={(e) => setOdds(e.target.value)}
                placeholder={oddsRequired ? "Required" : "Optional"}
                className={`scry-tap-target mt-0.5 w-full min-h-[40px] rounded-lg border bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 tabular-nums focus:outline-none ${
                  oddsRequired
                    ? "border-rose-500/40 focus:border-rose-500/60"
                    : "border-zinc-700/80 focus:border-violet-500/40"
                }`}
              />
            </label>
          </div>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={800}
            placeholder={
              isCounterMode
                ? "State your counter-thesis — why consensus is wrong."
                : "Post your read on this market."
            }
            className={`w-full rounded-lg border bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 resize-none focus:outline-none ${
              isCounterMode
                ? "border-rose-500/30 focus:border-rose-500/50"
                : "border-zinc-700/80 focus:border-violet-500/40"
            }`}
          />

          {error && <p className="text-[11px] text-rose-300/90">{error}</p>}

          <button
            type="submit"
            disabled={submitting || body.trim().length < 8}
            className={`scry-tap-target w-full sm:w-auto min-h-[44px] text-[12px] font-medium px-4 py-2.5 rounded-lg border transition disabled:opacity-50 ${
              isCounterMode
                ? "bg-rose-600/90 text-white border-rose-500/40 hover:bg-rose-600"
                : "bg-violet-600/90 text-white border-violet-500/30 hover:bg-violet-600"
            }`}
          >
            {submitting ? "Publishing…" : isCounterMode ? "Post counter-thesis" : "Post your read"}
          </button>
        </form>
      )}

      {!archived && !canPost && !loading && user && (
        <p className="px-4 py-3 text-[10px] text-zinc-600 border-b border-zinc-800/40 leading-relaxed">
          Take a position on this market to publish a public read in the thread.
        </p>
      )}

      {!archived && !loading && !user && (
        <div className="px-4 py-3 border-b border-zinc-800/40 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-zinc-500">
            Sign in to put your read on the record.
          </p>
          <button
            type="button"
            onClick={() => redirectToLogin(router, `/markets/${marketSlug}`)}
            className="scry-tap-target text-[11px] font-medium px-3 py-1.5 rounded-lg border border-violet-500/35 bg-violet-600/20 text-violet-200 hover:bg-violet-600/30 transition"
          >
            Sign in →
          </button>
        </div>
      )}

      <div className="px-4 py-2">
        {!loading && (thread?.posts.length ?? 0) > 1 && (
          <div
            className="flex items-center gap-1 pt-1.5 pb-0.5"
            role="tablist"
            aria-label="Sort reads"
          >
            {(
              [
                { id: "top" as const, label: "Top" },
                { id: "new" as const, label: "New" },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={sortKey === id}
                onClick={() => setSortKey(id)}
                className={`scry-tap-target text-[10px] font-semibold px-2.5 py-1 rounded-md transition ${
                  sortKey === id
                    ? "bg-zinc-100 text-zinc-950"
                    : "text-zinc-500 hover:text-zinc-300 border border-zinc-800/80"
                }`}
              >
                {label}
              </button>
            ))}
            {sortKey === "top" && (
              <span className="text-[9px] text-zinc-600 ml-1.5">
                Counter-theses and odds-on-record first
              </span>
            )}
          </div>
        )}
        {loading && <div className="h-20 rounded-lg bg-zinc-900/40 animate-pulse" />}
        {!loading && sortedPosts.length > 0 && (
          <ul>
            {sortedPosts.map((post) => (
              <PostRow key={post.id} post={post} archived={archived} />
            ))}
          </ul>
        )}
        {!loading && (!thread || thread.posts.length === 0) && (
          <p className="text-[11px] text-zinc-500 py-6 text-center leading-relaxed">
            {archived
              ? "No public reads were archived for this market."
              : "No public reads yet. Be first on record."}
          </p>
        )}
      </div>
    </section>
  );
}
