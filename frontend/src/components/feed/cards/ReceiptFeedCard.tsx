"use client";

import Link from "next/link";
import type { FeedEvent } from "../feedMix";
import { OutcomeProofBanner } from "../OutcomeProofBanner";
import { FeedCardFrame } from "./FeedCardFrame";
import { receiptHrefFromFeedEventId } from "@/lib/receipts";
import { GeneratedActivityLinks } from "../GeneratedActivityLinks";
import { resolveAgentFeedCopy } from "@/lib/feedAgentCopy";



function receiptScanLines(event: FeedEvent) {

  const side =

    event.probability != null && event.probability >= 50 ? "YES" : "NO";

  const conviction =

    event.confidence != null

      ? `${Math.round(event.confidence)}%`

      : event.probability != null

        ? `${Math.round(event.probability)}%`

        : null;

  const market = event.market_title ?? event.title;

  const delta = event.reputation_delta ?? 0;



  return {

    callLine: conviction

      ? `Called ${market} at ${conviction} (${side})`

      : `Called ${market} (${side})`,

    resultLine: "Result: Correct",

    repLine: delta > 0 ? `+${delta} credibility` : delta < 0 ? `${delta} credibility` : null,

  };

}



export function ReceiptFeedCard({

  event,

  index = 0,

  className,

  compact = false,

}: {

  event: FeedEvent;

  index?: number;

  className?: string;

  /** Home feed: strong receipt signal without feature-card dominance. */

  compact?: boolean;

}) {

  const { callLine, resultLine, repLine } = receiptScanLines(event);
  const verifiedHref =
    event.id != null ? receiptHrefFromFeedEventId(event.id) : "/verified-calls";
  const agentCopy = resolveAgentFeedCopy(event);

  return (

    <FeedCardFrame

      event={event}

      kind="receipt"

      index={index}

      className={className}

      compact={compact}

      footer={

        <div className="flex flex-wrap gap-2">

          <Link

            href={verifiedHref}

            className="text-[10px] font-medium text-emerald-300/90 hover:text-emerald-200"

          >

            View receipt →

          </Link>

          <GeneratedActivityLinks event={event} marketLabel="Market narrative" />

        </div>

      }

    >

      <OutcomeProofBanner event={event} />
      {event.is_generated_activity ? (
        <>
          <h2 className="text-[15px] font-semibold scry-text-primary leading-snug">
            {agentCopy.headline}
          </h2>
          {agentCopy.supporting ? (
            <p className="text-[12px] scry-text-secondary leading-relaxed line-clamp-3">
              {agentCopy.supporting}
            </p>
          ) : null}
          {repLine ? (
            <p className="text-[11px] text-emerald-400/85 font-medium tabular-nums">{repLine}</p>
          ) : null}
        </>
      ) : (
        <ul className="space-y-1 text-[12px] leading-snug">
          <li className="text-zinc-300">{callLine}</li>
          <li className="text-emerald-300/95 font-medium">{resultLine}</li>
          {repLine && (
            <li className="text-emerald-400/85 font-semibold tabular-nums">{repLine}</li>
          )}
        </ul>
      )}

      {event.reasoning?.summary && (

        <p className="text-[11px] scry-text-tertiary line-clamp-2 pt-0.5">

          {event.reasoning.summary}

        </p>

      )}

    </FeedCardFrame>

  );

}


