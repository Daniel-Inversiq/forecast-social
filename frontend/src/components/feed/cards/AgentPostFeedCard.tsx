"use client";

import Link from "next/link";
import type { FeedEvent } from "../feedMix";
import { FeedCardFrame } from "./FeedCardFrame";
import { MiniProbBar, MoveBadge } from "../shared";
import { ForecastThesisLine } from "@/components/forecast/ForecastThesisLine";
import { resolveCharacterMoment } from "../feedCharacterMoments";
import { GeneratedActivityLinks } from "../GeneratedActivityLinks";
import { resolveAgentFeedCopy } from "@/lib/feedAgentCopy";

const TYPE_HINT: Record<string, string> = {
  new_take: "Fresh read",
  position_update: "Conviction update",
  confidence_shift: "Shifted conviction",
  market_move: "Market reaction",
  signal_shift: "Signal change",
  stance_followup: "Follow-up",
  quiet_pulse: "Desk pulse",
};

export function AgentPostFeedCard({
  event,
  index = 0,
  className,
}: {
  event: FeedEvent;
  index?: number;
  className?: string;
}) {
  const moment = resolveCharacterMoment(event);
  const { headline, supporting } = resolveAgentFeedCopy(event);
  const legacyHint = event.is_generated_activity
    ? null
    : TYPE_HINT[event.type] ?? "Forecast";

  return (
    <FeedCardFrame
      event={event}
      kind="agent_post"
      index={index}
      className={className}
      footer={
        <div className="flex flex-wrap gap-2 pt-2">
          <Link
            href={`/agents/${event.agent.slug}`}
            className="text-[10px] font-medium text-violet-300/90 hover:text-violet-200"
          >
            Follow desk →
          </Link>
          <GeneratedActivityLinks event={event} />
        </div>
      }
    >
      {legacyHint ? (
        <p className="text-[10px] text-violet-300/65 font-medium">{legacyHint}</p>
      ) : null}
      <h2 className="text-[15px] font-semibold scry-text-primary leading-snug">{headline}</h2>
      {supporting ? (
        <p className="text-[12px] scry-text-secondary leading-relaxed line-clamp-4 whitespace-pre-line">
          {supporting}
        </p>
      ) : null}
      <ForecastThesisLine thesis={event.forecast_thesis ?? undefined} className="mt-1" />
      {moment && (
        <p className="text-[10px] text-zinc-500 italic line-clamp-1">{moment.text}</p>
      )}
      {event.probability != null && (
        <div className="flex items-center gap-3 pt-1">
          <span className="text-2xl font-semibold tabular-nums scry-text-primary">
            {Math.round(event.probability)}
            <span className="text-[11px] text-violet-400/60">%</span>
          </span>
          <div className="flex-1 min-w-0">
            <MiniProbBar value={event.probability} size="xs" />
            {event.confidence != null && (
              <p className="text-[9px] scry-text-tertiary mt-0.5">{Math.round(event.confidence)}% confidence</p>
            )}
          </div>
          {event.movement_delta != null && event.movement_delta !== 0 && (
            <MoveBadge delta={event.movement_delta} />
          )}
        </div>
      )}
      {event.personalization_reason && (
        <p className="text-[9px] text-violet-400/55">{event.personalization_reason}</p>
      )}
    </FeedCardFrame>
  );
}
