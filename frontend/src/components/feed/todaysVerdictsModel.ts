import type { FeedEvent } from "./feedMix";
import { receiptHrefFromFeedEventId } from "@/lib/receipts";

export type VerdictSlotKind = "called_it" | "exposed" | "mover" | "battle";

export type VerdictSlot = {
  kind: VerdictSlotKind;
  /** Section kicker, e.g. "CALLED IT". */
  kicker: string;
  agent: { name: string; slug: string; avatar_color?: string };
  /** Second name for battle slots. */
  opponent?: { name: string; slug: string } | null;
  /** The one-line story (forecast title or thesis). */
  line: string;
  /** The consequence — "+11 rep", "−9 rep", "42pt split". */
  stat: string | null;
  statTone: "up" | "down" | "hot";
  href: string;
};

export type TodaysVerdictsData = {
  slots: VerdictSlot[];
  /** Open calls resolving tonight/soon — anticipation hook. */
  resolvingSoonCount: number;
};

type BattleLike = {
  agent_a: { name: string; slug: string };
  agent_b: { name: string; slug: string };
  market_title?: string | null;
  disagreement_score?: number;
};

const RECEIPT_TYPES = new Set(["receipt", "verified_call"]);
const MOVER_TYPES = new Set(["leaderboard_move", "reputation_move", "calibration_jump"]);
const BATTLE_TYPES = new Set(["rivalry", "battle_escalation"]);

function repMagnitude(e: FeedEvent): number {
  return Math.abs(e.reputation_delta ?? 0);
}

function bestBy<T>(items: T[], score: (item: T) => number): T | null {
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const item of items) {
    const s = score(item);
    if (s > bestScore) {
      best = item;
      bestScore = s;
    }
  }
  return best;
}

function storyLine(e: FeedEvent): string {
  return (e.forecast_thesis ?? e.title ?? "").trim() || e.market_title?.trim() || "";
}

function formatRep(delta: number): string {
  const mag = Math.abs(delta);
  const rounded = mag >= 1 ? Math.round(mag) : Math.round(mag * 10) / 10;
  return `${delta > 0 ? "+" : "−"}${rounded} rep`;
}

/**
 * Derive the day's verdict slots from the already-loaded feed.
 * Pure — safe to unit test, no fetching, no synthesis: a slot only renders
 * when the underlying event exists.
 */
export function deriveTodaysVerdicts(
  events: FeedEvent[],
  streamBattles: BattleLike[] = [],
): TodaysVerdictsData {
  const slots: VerdictSlot[] = [];
  const usedIds = new Set<number>();

  const receipt = bestBy(
    events.filter((e) => RECEIPT_TYPES.has(e.type) || e.has_verified_proof === true),
    (e) => repMagnitude(e) * 100 + (e.confidence ?? 0),
  );
  if (receipt) {
    if (receipt.id != null) usedIds.add(receipt.id);
    slots.push({
      kind: "called_it",
      kicker: "Called it",
      agent: receipt.agent,
      line: storyLine(receipt),
      stat:
        receipt.reputation_delta != null && receipt.reputation_delta !== 0
          ? formatRep(receipt.reputation_delta)
          : "Verified",
      statTone: "up",
      href:
        receipt.type === "receipt" && receipt.id != null
          ? receiptHrefFromFeedEventId(receipt.id)
          : "/verified-calls",
    });
  }

  const exposed = bestBy(
    events.filter((e) => e.type === "failed_high_conviction_call"),
    (e) => repMagnitude(e) * 100 + (e.confidence ?? 0),
  );
  if (exposed) {
    if (exposed.id != null) usedIds.add(exposed.id);
    slots.push({
      kind: "exposed",
      kicker: "Exposed",
      agent: exposed.agent,
      line: storyLine(exposed),
      stat:
        exposed.reputation_delta != null && exposed.reputation_delta !== 0
          ? formatRep(exposed.reputation_delta)
          : exposed.confidence != null
            ? `was ${exposed.confidence}% sure`
            : null,
      statTone: "down",
      href: `/agents/${exposed.agent.slug}`,
    });
  }

  const mover = bestBy(
    events.filter(
      (e) =>
        MOVER_TYPES.has(e.type) &&
        (e.id == null || !usedIds.has(e.id)) &&
        repMagnitude(e) > 0,
    ),
    repMagnitude,
  );
  if (mover) {
    slots.push({
      kind: "mover",
      kicker: "On the move",
      agent: mover.agent,
      line: storyLine(mover),
      stat: formatRep(mover.reputation_delta!),
      statTone: (mover.reputation_delta ?? 0) >= 0 ? "up" : "down",
      href: `/agents/${mover.agent.slug}`,
    });
  }

  const battleEvent = bestBy(
    events.filter((e) => BATTLE_TYPES.has(e.type)),
    (e) => e.disagreement_spread ?? 0,
  );
  if (battleEvent && battleEvent.opponent_name && battleEvent.opponent_slug) {
    slots.push({
      kind: "battle",
      kicker: "Hottest battle",
      agent: battleEvent.agent,
      opponent: { name: battleEvent.opponent_name, slug: battleEvent.opponent_slug },
      line: storyLine(battleEvent),
      stat:
        battleEvent.disagreement_spread != null
          ? `${battleEvent.disagreement_spread}pt split`
          : null,
      statTone: "hot",
      href: "/battles",
    });
  } else {
    const streamed = bestBy(streamBattles, (b) => b.disagreement_score ?? 0);
    if (streamed) {
      slots.push({
        kind: "battle",
        kicker: "Hottest battle",
        agent: { name: streamed.agent_a.name, slug: streamed.agent_a.slug },
        opponent: streamed.agent_b,
        line: streamed.market_title?.trim() || "Live disagreement on the network",
        stat:
          streamed.disagreement_score != null
            ? `${Math.round(streamed.disagreement_score)}pt split`
            : null,
        statTone: "hot",
        href: "/battles",
      });
    }
  }

  const soonMarkets = new Set<string>();
  let resolvingSoonCount = 0;
  for (const e of events) {
    if (e.resolution_horizon_bucket !== "tonight" && e.resolution_horizon_bucket !== "soon") {
      continue;
    }
    const key = e.market_slug ?? (e.id != null ? `event-${e.id}` : null);
    if (key == null || soonMarkets.has(key)) continue;
    soonMarkets.add(key);
    resolvingSoonCount += 1;
  }

  return { slots, resolvingSoonCount };
}
