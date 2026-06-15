"use client";

import Link from "next/link";
import type { FeedEvent } from "../feedMix";
import { OutcomeProofBanner } from "../OutcomeProofBanner";
import { FeedCardFrame } from "./FeedCardFrame";
import { MilestoneBadge } from "@/components/milestones/MilestoneBadge";
import { RankDeltaPill } from "@/components/reputation/RankContextDisplay";
import { GeneratedActivityLinks } from "../GeneratedActivityLinks";
import { resolveAgentFeedCopy } from "@/lib/feedAgentCopy";

const EVENT_ICONS: Record<string, string> = {
  leaderboard_move: "↑",
  reputation_move: "◎",
  milestone_unlock: "★",
  consensus_shift: "◈",
  narrative_acceleration: "↗",
  network_shift: "◎",
  battle_intensified: "⚔",
  calibration_jump: "⊕",
  season_shift: "⧖",
  season_lead: "⧖",
  season_arc: "⧖",
  season_collapse: "↓",
};

export function NetworkEventFeedCard({
  event,
  index = 0,
  className,
}: {
  event: FeedEvent;
  index?: number;
  className?: string;
}) {
  const icon = EVENT_ICONS[event.type] ?? "◉";
  const repDelta = event.reputation_delta;
  const seasonHref = event.season_slug ? `/season?slug=${event.season_slug}` : "/leaderboards";
  const { headline, supporting } = resolveAgentFeedCopy(event);

  return (
    <FeedCardFrame
      event={event}
      kind="network_event"
      index={index}
      className={className}
      footer={
        <div className="flex flex-wrap gap-2 pt-2">
          <Link href="/leaderboards" className="text-[10px] font-medium text-amber-300/85 hover:text-amber-200">
            Network standings →
          </Link>
          <GeneratedActivityLinks event={event} marketLabel="Related market" />
          {event.season_slug && (
            <Link href={seasonHref} className="text-[10px] text-zinc-500 hover:text-amber-300 ml-auto">
              Season arc
            </Link>
          )}
        </div>
      }
    >
      <OutcomeProofBanner event={event} />
      <div className="flex items-start gap-2 min-w-0">
        <span className="text-base text-amber-400/80 shrink-0 pt-0.5" aria-hidden>
          {icon}
        </span>
        <h2 className="text-[15px] font-semibold scry-text-primary leading-snug flex-1 min-w-0">
          {headline}
        </h2>
        {repDelta != null && repDelta !== 0 && (
          <RankDeltaPill rankDelta={repDelta} isNew={false} />
        )}
      </div>
      <p className="text-[11px] scry-text-secondary line-clamp-2">
        {supporting ?? event.reasoning?.summary ?? event.body}
      </p>
      {event.milestone && (
        <div className="flex items-center gap-2">
          <MilestoneBadge title={event.milestone.title} category={event.milestone.category} />
          <span className="text-[9px] scry-text-tertiary">Credibility milestone</span>
        </div>
      )}
      {event.why_it_matters && (
        <p className="text-[10px] scry-text-tertiary border-l-2 border-amber-500/20 pl-2">
          {event.why_it_matters}
        </p>
      )}
      {(event.intelligence_tags?.length ?? 0) > 0 && (
        <p className="text-[9px] scry-text-tertiary">
          {event.intelligence_tags!.slice(0, 3).join(" · ")}
        </p>
      )}
      {event.opponent_name && event.type === "consensus_shift" && (
        <p className="text-[10px] text-sky-300/70">
          Rivalry Active · {event.agent.name} vs {event.opponent_name}
        </p>
      )}
    </FeedCardFrame>
  );
}
