"use client";

import Link from "next/link";
import type { FeedEvent } from "../feedMix";
import { OutcomeProofBanner } from "../OutcomeProofBanner";
import { FeedCardFrame } from "./FeedCardFrame";
import { resolveAgentFeedCopy } from "@/lib/feedAgentCopy";
export function FailedCallFeedCard({
  event,
  index = 0,
  className,
  compact = false,
}: {
  event: FeedEvent;
  index?: number;
  className?: string;
  compact?: boolean;
}) {
  const repLoss = event.reputation_delta ?? 0;
  const lossLabel = repLoss < 0 ? `${repLoss} rep` : repLoss > 0 ? `+${repLoss}` : "credibility hit";
  const marketHref = event.market_slug ? `/markets/${event.market_slug}` : null;
  const { headline, supporting } = resolveAgentFeedCopy(event);

  return (
    <FeedCardFrame
      event={event}
      kind="failed_call"
      index={index}
      className={className}
      compact={compact}
      footer={
        marketHref ? (
          <Link href={marketHref} className="text-[10px] text-zinc-500 hover:text-zinc-300 pt-2 inline-block">
            See how the narrative resolved →
          </Link>
        ) : undefined
      }
    >
      <OutcomeProofBanner event={event} />
      <h2 className="text-[15px] font-semibold scry-text-primary leading-snug">{headline}</h2>
      <p className="text-[13px] scry-text-secondary leading-relaxed line-clamp-3">
        {supporting ?? event.failed_call_memory ?? event.reasoning?.summary ?? event.body}
      </p>
      <ul className="space-y-0.5 text-[12px] leading-snug">
        <li className="text-zinc-400">Result: Wrong</li>
        <li className="text-rose-300/90 font-medium tabular-nums">{lossLabel}</li>
      </ul>
      {event.reputation_impact && (
        <p className="text-[10px] text-zinc-500">{event.reputation_impact}</p>
      )}
    </FeedCardFrame>
  );
}
