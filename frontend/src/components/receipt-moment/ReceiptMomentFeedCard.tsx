"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motionClass } from "@/components/feed/motion";
import { enrichVerifiedCall } from "@/components/verified-calls/verifiedCallEnrichment";
import type { FeedEvent } from "@/components/feed/feedMix";
import type { VerifiedCallBase } from "@/components/verified-calls/types";
import { feedEventToReceiptId } from "./receiptMomentQualifies";
import { ReceiptMomentCard } from "./ReceiptMomentCard";
import { receiptDetailPath } from "@/lib/receiptIds";

function feedEventToVerifiedCall(event: FeedEvent): VerifiedCallBase {
  const side =
    event.probability != null && event.probability >= 50 ? "YES" : "NO";
  const receiptId = feedEventToReceiptId(event) ?? `receipt-event-${event.id ?? 0}`;
  return {
    id: receiptId,
    agent_name: event.agent.name,
    agent_slug: event.agent.slug,
    avatar_color: event.agent.avatar_color ?? "#71717a",
    market_title: event.market_title ?? event.title,
    market_slug: event.market_slug ?? "market",
    side,
    confidence: event.confidence ?? 80,
    original_take: event.body,
    original_probability: event.probability ?? 50,
    final_outcome: side,
    days_early: 7 + (event.id ?? 0) % 18,
    created_at: event.created_at,
    receipt_strength:
      (event.confidence ?? 0) >= 88 ? "legendary" : (event.confidence ?? 0) >= 80 ? "early" : "strong",
    reputation_delta: event.reputation_delta ?? undefined,
    consensus_breaking: event.credibility_split?.consensus_breaking,
  };
}

export function ReceiptMomentFeedCard({
  event,
  index = 0,
  className,
}: {
  event: FeedEvent;
  index?: number;
  className?: string;
}) {
  const call = useMemo(
    () => enrichVerifiedCall(feedEventToVerifiedCall(event)),
    [event],
  );
  const detailHref = receiptDetailPath(call.id);

  return (
    <div className={`feed-post-card feed-post-card--receipt feed-post-card--feature ${className ?? ""}`}>
      <ReceiptMomentCard call={call} variant="feed" index={index} showActions={false} />
      <div
        className={`mt-2 flex items-center justify-between gap-2 px-1 ${motionClass.cardEnterStagger(index + 1)}`}
      >
        <p className="text-[10px] text-zinc-600">Major verified call · feed moment</p>
        <Link
          href={detailHref}
          className="text-[10px] font-medium text-amber-300/90 hover:text-amber-200 transition"
        >
          View receipt →
        </Link>
      </div>
    </div>
  );
}
