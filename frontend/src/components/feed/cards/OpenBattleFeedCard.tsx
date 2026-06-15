"use client";

import Link from "next/link";
import { resolveFeedActionLabel } from "@/lib/feedActionStates";
import type { FeedEvent } from "../feedMix";
import { FeedCardFrame } from "./FeedCardFrame";
import { MiniProbBar, MoveBadge } from "../shared";
import { GeneratedActivityLinks } from "../GeneratedActivityLinks";
import { resolveAgentFeedCopy, shouldHideFeedActionLabel } from "@/lib/feedAgentCopy";

function opponentFromEvent(event: FeedEvent): { name: string; slug: string } | null {
  if (event.opponent_name && event.opponent_slug) {
    return { name: event.opponent_name, slug: event.opponent_slug };
  }
  const disagrees = event.reasoning?.who_disagrees;
  if (!disagrees) return null;
  const slug = disagrees.toLowerCase().replace(/\s+/g, "-").slice(0, 48);
  return { name: disagrees, slug };
}

export function OpenBattleFeedCard({
  event,
  index = 0,
  className,
}: {
  event: FeedEvent;
  index?: number;
  className?: string;
}) {
  const opponent = opponentFromEvent(event);
  const spread = event.disagreement_spread ?? 24;
  const marketHref = event.market_slug ? `/markets/${event.market_slug}` : null;
  const battleHref = event.related_battle_slug
    ? `/battles/${event.related_battle_slug}`
    : "/battles";
  const { headline, supporting } = resolveAgentFeedCopy(event);
  const showActionLabel = !shouldHideFeedActionLabel(event);

  return (
    <FeedCardFrame
      event={event}
      kind="open_battle"
      index={index}
      className={className}
      footer={
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Link
            href={battleHref}
            className="text-[10px] font-medium text-rose-300/90 hover:text-rose-200 transition"
          >
            View battle →
          </Link>
          <GeneratedActivityLinks event={event} marketLabel="Follow thread" battleLabel="Public clash" />
          {marketHref && !event.related_battle_slug && (
            <Link
              href={marketHref}
              className="text-[10px] text-zinc-500 hover:text-violet-300 transition ml-auto"
            >
              Follow thread →
            </Link>
          )}
        </div>
      }
    >
      {showActionLabel ? (
        <p className="text-[10px] text-rose-300/70 font-medium uppercase tracking-wide">
          {resolveFeedActionLabel(event)}
        </p>
      ) : null}
      <h2 className="text-[15px] font-semibold scry-text-primary leading-snug">{headline}</h2>
      {supporting ? (
        <p className="text-[12px] scry-text-secondary leading-relaxed line-clamp-3">{supporting}</p>
      ) : null}

      {opponent ? (
        <p className="text-[11px] text-zinc-500">
          vs{" "}
          <Link href={`/agents/${opponent.slug}`} className="text-zinc-400 hover:text-zinc-200">
            {opponent.name}
          </Link>
          <span className="text-zinc-600"> · {spread}pt gap</span>
        </p>
      ) : null}

      {event.probability != null && (
        <MiniProbBar value={event.probability} size="xs" />
      )}
      {event.movement_delta != null && event.movement_delta !== 0 && (
        <div className="flex justify-end">
          <MoveBadge delta={event.movement_delta} />
        </div>
      )}
      {event.horizon_label && (
        <p className="text-[10px] text-amber-200/85 font-medium">{event.horizon_label}</p>
      )}
    </FeedCardFrame>
  );
}
