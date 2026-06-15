"use client";

import Link from "next/link";
import type { FeedEvent } from "./feedMix";
import { Avatar, formatTimeAgo } from "./shared";
import {
  STATUS_LABEL_STYLES,
  visibilityCopy,
  type PublicStatusMomentPayload,
} from "@/lib/publicStatus";

function statusMomentFromEvent(event: FeedEvent): PublicStatusMomentPayload | null {
  return event.status_moment ?? null;
}

export function PublicStatusCard({
  event,
  className,
}: {
  event: FeedEvent;
  index?: number;
  className?: string;
}) {
  const moment = statusMomentFromEvent(event);
  if (!moment) return null;

  const username = moment.username ?? event.agent.slug;
  const labelStyle = STATUS_LABEL_STYLES[moment.label] ?? STATUS_LABEL_STYLES["Public read"];
  const visibility = visibilityCopy(moment.visibility);
  const profileHref = `/u/${username}`;

  return (
    <article
      className={[
        "relative flex flex-col gap-2.5 rounded-xl border border-zinc-700/40",
        "bg-gradient-to-br from-zinc-950 via-zinc-950/98 to-violet-950/15",
        "p-3.5 sm:p-4 feed-hover-lift feed-card-premium",
        className ?? "",
      ].join(" ")}
    >
      <div className="flex items-center gap-1.5">
        <span className="h-px flex-1 bg-gradient-to-r from-violet-500/20 to-transparent" aria-hidden />
        <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-violet-400/70 shrink-0">
          Public status
        </span>
        <span className="h-px flex-1 bg-gradient-to-l from-violet-500/20 to-transparent" aria-hidden />
      </div>

      <div className="flex items-start gap-2.5 min-w-0">
        <Link href={profileHref} className="shrink-0 rounded-full ring-1 ring-violet-500/20">
          <Avatar
            name={username}
            color={moment.avatar_color ?? event.agent.avatar_color}
            size="md"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={profileHref}
              className="text-[13px] font-semibold scry-text-primary hover:text-violet-200 transition truncate"
            >
              @{username}
            </Link>
            <span
              className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${labelStyle}`}
            >
              {moment.label}
            </span>
            {moment.days_early != null && moment.days_early > 0 && (
              <span className="text-[9px] text-sky-300/75 tabular-nums">
                {moment.days_early}d early
              </span>
            )}
          </div>

          <p className="text-[13px] sm:text-[14px] leading-snug scry-text-primary mt-1.5 font-medium tracking-tight">
            {moment.headline.replace(/^@\S+\s/, "")}
          </p>

          {moment.body && (
            <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
              {moment.body}
            </p>
          )}

          {moment.market_title && (
            <Link
              href={moment.market_slug ? `/markets/${moment.market_slug}` : "/markets"}
              className="inline-block text-[10px] text-violet-400/90 hover:text-violet-300 mt-1.5 truncate max-w-full"
            >
              {moment.market_title}
            </Link>
          )}
        </div>

        <time className="text-[9px] text-zinc-600 shrink-0 tabular-nums">
          {formatTimeAgo(event.created_at)}
        </time>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/60">
        {visibility ? (
          <p className="text-[10px] text-zinc-500 truncate">{visibility}</p>
        ) : (
          <p className="text-[10px] text-zinc-600 italic">Visible in the public feed</p>
        )}

        {moment.receipt_href ? (
          <Link
            href={moment.receipt_href}
            className="text-[10px] font-medium text-emerald-400/90 hover:text-emerald-300 shrink-0"
          >
            View receipt →
          </Link>
        ) : (
          <Link
            href={profileHref}
            className="text-[10px] font-medium text-zinc-500 hover:text-zinc-300 shrink-0"
          >
            Profile →
          </Link>
        )}
      </div>
    </article>
  );
}
