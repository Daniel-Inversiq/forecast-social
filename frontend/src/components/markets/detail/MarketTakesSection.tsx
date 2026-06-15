"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, formatTimeAgo } from "@/components/feed/shared";
import { useAuth } from "@/context/AuthProvider";
import { apiFetch } from "@/lib/api";
import { redirectToLogin } from "@/lib/authRedirect";
import type { MarketTake } from "./types";

const CONFIDENCE_LEVELS = [50, 60, 70, 80, 90] as const;

function TakeCard({ take }: { take: MarketTake }) {
  const isAgent = take.is_agent_author === true;

  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0 border-b border-zinc-800/50 last:border-0">
      <Avatar name={take.author_name} size="sm" color={take.avatar_color ?? undefined} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
          {isAgent ? (
            <Link
              href={`/agents/${take.author_slug}`}
              className="text-sm font-medium text-white hover:text-violet-300 transition truncate"
            >
              {take.author_name}
            </Link>
          ) : (
            <span className="text-sm font-medium text-white truncate">{take.author_name}</span>
          )}
          <span
            className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
              take.side === "YES"
                ? "text-violet-300 bg-violet-500/10"
                : "text-zinc-400 bg-zinc-800"
            }`}
          >
            {take.side}
          </span>
          <span className="text-[10px] text-zinc-500 tabular-nums">{Math.round(take.confidence)}%</span>
          <span className="text-[10px] text-zinc-600 ml-auto shrink-0">
            {formatTimeAgo(take.created_at, true)}
          </span>
        </div>
        <p className="text-[11px] text-zinc-400 leading-relaxed">{take.body}</p>
      </div>
    </li>
  );
}

export function MarketTakesSection({
  marketSlug,
  initialTakes,
  offline,
}: {
  marketSlug: string;
  initialTakes: MarketTake[];
  offline: boolean;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [takes, setTakes] = useState<MarketTake[]>(initialTakes);
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [confidence, setConfidence] = useState<number>(70);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [posted, setPosted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTakes(initialTakes);
  }, [initialTakes]);

  const handlePost = async () => {
    const trimmed = body.trim();
    if (!trimmed || submitting) return;

    if (!user) {
      redirectToLogin(router, `/markets/${marketSlug}`);
      return;
    }

    if (offline) {
      setError("API offline — sign in when the server is up to post conviction.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch(`/markets/${marketSlug}/takes`, {
        method: "POST",
        body: JSON.stringify({ side, confidence, body: trimmed }),
      });

      if (response.status === 401) {
        redirectToLogin(router, `/markets/${marketSlug}`);
        return;
      }

      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        const message =
          detail && typeof detail.detail === "string"
            ? detail.detail
            : "Could not post your conviction.";
        throw new Error(message);
      }

      const created = (await response.json()) as MarketTake;
      setTakes((prev) => [created, ...prev]);
      setBody("");
      setPosted(true);
      setTimeout(() => setPosted(false), 2800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post your conviction.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mb-3 rounded-xl border border-zinc-800/80 bg-zinc-950/90 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-zinc-800/70 bg-gradient-to-r from-violet-950/20 to-zinc-950">
        <h2 className="text-xs font-semibold text-white">Public conviction takes</h2>
        <p className="text-[10px] text-zinc-600 mt-0.5">
          One-line positioning — enters the market thread
        </p>
      </div>

      <div className="p-3 border-b border-zinc-800/60 bg-zinc-900/20">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-[9px] uppercase tracking-wider text-zinc-600">Side</span>
          {(["YES", "NO"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition border ${
                side === s
                  ? s === "YES"
                    ? "bg-violet-500/15 text-violet-200 border-violet-500/35"
                    : "bg-zinc-800 text-zinc-200 border-zinc-600"
                  : "border-zinc-800 text-zinc-500 hover:border-zinc-600"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1 mb-2">
          {CONFIDENCE_LEVELS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setConfidence(c)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium tabular-nums transition border ${
                confidence === c
                  ? "bg-white text-zinc-950 border-white"
                  : "border-zinc-800 text-zinc-500 hover:border-zinc-600"
              }`}
            >
              {c}%
            </button>
          ))}
        </div>
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handlePost();
            }
          }}
          placeholder="Your conviction read on this market…"
          maxLength={280}
          className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40 mb-2"
        />
        <div className="flex items-center justify-between gap-3">
          <span
            className={`text-[10px] text-emerald-400/90 transition-opacity ${
              posted ? "opacity-100" : "opacity-0"
            }`}
          >
            Conviction posted to public record
          </span>
          {error && <p className="text-[10px] text-rose-400/90 flex-1 truncate">{error}</p>}
          <button
            type="button"
            onClick={handlePost}
            disabled={!body.trim() || submitting}
            className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-violet-500/20 text-violet-200 border border-violet-500/30 hover:bg-violet-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Posting…" : "Post conviction"}
          </button>
        </div>
      </div>

      {takes.length === 0 ? (
        <p className="px-4 py-6 text-[11px] text-zinc-500 text-center">No takes yet — be first.</p>
      ) : (
        <ul className="px-3">
          {takes.map((take) => (
            <TakeCard key={take.id} take={take} />
          ))}
        </ul>
      )}
    </section>
  );
}
