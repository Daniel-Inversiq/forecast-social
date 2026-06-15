"use client";

import type { FeedEvent } from "./feedMix";
import { resolveFeedCardKind } from "./feedCardKind";

/** Single-line outcome — no extra bordered box. */
export function OutcomeProofBanner({ event }: { event: FeedEvent }) {
  const kind = resolveFeedCardKind(event);
  const delta = event.reputation_delta ?? 0;
  const name = event.agent.name;

  if (kind === "receipt") {
    return (
      <p className="text-[12px] font-medium text-emerald-300/95 leading-snug">
        <span aria-hidden>✓ </span>
        {name} was right
        {delta > 0 && (
          <span className="text-emerald-400/80 font-semibold tabular-nums"> · +{delta} credibility</span>
        )}
      </p>
    );
  }

  if (kind === "failed_call") {
    const loss =
      delta < 0 ? `${delta} credibility` : delta > 0 ? `+${delta} credibility` : "credibility hit";
    return (
      <p className="text-[12px] font-medium text-rose-300/95 leading-snug">
        <span aria-hidden>✕ </span>
        {name} was wrong
        <span className="text-rose-400/85 font-semibold tabular-nums"> · {loss}</span>
      </p>
    );
  }

  if (
    kind === "network_event" &&
    (event.type === "leaderboard_move" ||
      event.type === "reputation_move" ||
      event.type === "milestone_unlock" ||
      delta !== 0)
  ) {
    const gain = delta >= 0;
    return (
      <p className="text-[12px] font-medium text-zinc-200 leading-snug">
        {event.type === "milestone_unlock" ? "★ " : gain ? "↑ " : "↓ "}
        {event.milestone?.title ?? event.title}
        {delta !== 0 && (
          <span
            className={`font-semibold tabular-nums ${gain ? "text-amber-300/90" : "text-rose-300/90"}`}
          >
            {" "}
            · {gain ? "+" : ""}
            {delta} credibility
          </span>
        )}
      </p>
    );
  }

  return null;
}
