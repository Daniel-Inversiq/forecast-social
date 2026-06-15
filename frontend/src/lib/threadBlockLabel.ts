import type { FeedEvent } from "@/components/feed/feedMix";

export type ThreadBlockLabel =
  | "Public Clash"
  | "Narrative Shift"
  | "Receipt Locked"
  | "Desk Note"
  | "Market Read";

const RECEIPT_ACTIVITY_TYPES = new Set(["receipt_reaction", "receipt_victory"]);
const RIVAL_ACTIVITY_TYPES = new Set(["rival_reply", "battle_response"]);

const NARRATIVE_ACTIVITY_TYPES = new Set([
  "conviction_update",
  "network_pulse",
  "network_briefing_item",
]);

const NARRATIVE_EVENT_TYPES = new Set([
  "consensus_shift",
  "narrative_acceleration",
  "signal_shift",
  "confidence_shift",
  "market_move",
]);

const CALM_NARRATIVE_KINDS = new Set(["calm_thread_narrative"]);
const CALM_MARKET_KINDS = new Set(["calm_thread_market_read"]);

const CALM_AGREEMENT_PHRASES = [
  "fair point",
  "good point",
  "valid point",
  "well said",
  "i agree",
  "agree with",
  "same page",
  "couldn't agree",
  "could not agree",
  "spot on",
  "exactly right",
  "great point",
  "momentum can persist",
  "tape is strong",
];

const EXPLICIT_OPPOSITION_PHRASES = [
  "wrong",
  "missed",
  "not pricing",
  "assuming",
  "against",
  "disagrees",
  "disagree",
  "lags",
  "late",
  "you're wrong",
  "you are wrong",
  "that's wrong",
  "that is wrong",
  "i disagree",
  "hard disagree",
  "strongly disagree",
  "won't concede",
  "refuse to concede",
  "counterpoint",
  "push back",
  "pushback",
  "overstated",
  "understated",
  "too bullish",
  "too bearish",
  "misses the",
  "ignores the",
];

const NAMED_RIVAL_COUNTER_CUES = [
  "wrong",
  "missed",
  "not pricing",
  "assuming",
  "against",
  "disagrees",
  "disagree",
  "lags",
  "late",
];

export const THREAD_BLOCK_LABELS: ThreadBlockLabel[] = [
  "Public Clash",
  "Narrative Shift",
  "Receipt Locked",
  "Desk Note",
  "Market Read",
];

function eventContinuationKind(event: FeedEvent): string | undefined {
  const kind = (event as FeedEvent & { continuation_kind?: string }).continuation_kind;
  return typeof kind === "string" ? kind : undefined;
}

function eventCopyText(event: FeedEvent): string {
  return `${event.title ?? ""} ${event.body ?? ""}`.trim().toLowerCase();
}

function threadTone(event: FeedEvent): string | undefined {
  const tone = (event as FeedEvent & { thread_tone?: string }).thread_tone;
  return typeof tone === "string" ? tone : undefined;
}

function isCalmThreadEvent(event: FeedEvent): boolean {
  if (threadTone(event) === "calm") return true;
  const kind = eventContinuationKind(event);
  return Boolean(kind?.startsWith("calm_thread_"));
}

export function isHeatedThread(events: FeedEvent[]): boolean {
  return events.some((event) => threadTone(event) === "heated");
}

function hasNarrativeStage(event: FeedEvent): boolean {
  return Boolean(event.narrative_stage);
}

function isCalmContinuationCopy(copy: string): boolean {
  if (!copy) return true;
  if (CALM_AGREEMENT_PHRASES.some((phrase) => copy.includes(phrase))) return true;
  if (/\b(agree|agreed)\b/.test(copy) && !/\b(disagree|don't agree|do not agree)\b/.test(copy)) {
    return true;
  }
  return false;
}

function hasExplicitOpposition(copy: string): boolean {
  return EXPLICIT_OPPOSITION_PHRASES.some((phrase) => copy.includes(phrase));
}

function rivalNameTokens(event: FeedEvent): string[] {
  const names = [
    event.opponent_name,
    event.parent_activity?.agent_name,
    event.opponent_slug?.replace(/-/g, " "),
  ].filter((name): name is string => Boolean(name?.trim()));

  const tokens = new Set<string>();
  for (const name of names) {
    const lower = name.toLowerCase();
    tokens.add(lower);
    const first = lower.split(/\s+/)[0];
    if (first) tokens.add(first);
  }
  return [...tokens];
}

function namesRivalInCopy(event: FeedEvent, copy: string): boolean {
  return rivalNameTokens(event).some((token) => copy.includes(token));
}

function hasNamedRivalWithCounterCue(event: FeedEvent, copy: string): boolean {
  if (!namesRivalInCopy(event, copy)) return false;
  return NAMED_RIVAL_COUNTER_CUES.some((cue) => copy.includes(cue));
}

/** Rival reply types only count as clash when copy is explicitly adversarial. */
export function isExplicitlyAdversarialRivalEvent(event: FeedEvent): boolean {
  if (!event.activity_type || !RIVAL_ACTIVITY_TYPES.has(event.activity_type)) {
    return false;
  }
  if (threadTone(event) === "calm") return false;
  const copy = eventCopyText(event);
  if (isCalmContinuationCopy(copy)) return false;
  return hasExplicitOpposition(copy) || hasNamedRivalWithCounterCue(event, copy);
}

export function isPublicClashThread(events: FeedEvent[]): boolean {
  if (isHeatedThread(events)) return true;
  return events.some(isExplicitlyAdversarialRivalEvent);
}

export function resolveThreadBlockLabel(events: FeedEvent[]): ThreadBlockLabel {
  if (
    events.some(
      (event) =>
        (event.activity_type && RECEIPT_ACTIVITY_TYPES.has(event.activity_type)) ||
        event.type === "receipt" ||
        event.type === "verified_call",
    )
  ) {
    return "Receipt Locked";
  }

  if (!isHeatedThread(events) && events.some(hasNarrativeStage)) {
    return "Narrative Shift";
  }

  if (isPublicClashThread(events)) {
    return "Public Clash";
  }

  if (
    events.some(
      (event) =>
        CALM_NARRATIVE_KINDS.has(eventContinuationKind(event) ?? "") ||
        (isCalmThreadEvent(event) &&
          ((event.activity_type && NARRATIVE_ACTIVITY_TYPES.has(event.activity_type)) ||
            Boolean(event.narrative_id || event.narrative_label))),
    )
  ) {
    return "Narrative Shift";
  }

  if (
    events.some(
      (event) =>
        CALM_MARKET_KINDS.has(eventContinuationKind(event) ?? "") ||
        (isCalmThreadEvent(event) &&
          Boolean((event as FeedEvent & { related_market_slug?: string }).related_market_slug)),
    )
  ) {
    return "Market Read";
  }

  if (
    events.some(
      (event) =>
        (event.activity_type && NARRATIVE_ACTIVITY_TYPES.has(event.activity_type)) ||
        NARRATIVE_EVENT_TYPES.has(event.type) ||
        Boolean(event.narrative_id || event.narrative_label),
    )
  ) {
    return "Narrative Shift";
  }

  if (
    events.some(
      (event) =>
        event.activity_type &&
        RIVAL_ACTIVITY_TYPES.has(event.activity_type) &&
        Boolean((event as FeedEvent & { related_market_slug?: string }).related_market_slug),
    )
  ) {
    return "Market Read";
  }

  return "Desk Note";
}

export function emptyThreadLabelCounts(): Record<ThreadBlockLabel, number> {
  return {
    "Public Clash": 0,
    "Narrative Shift": 0,
    "Receipt Locked": 0,
    "Desk Note": 0,
    "Market Read": 0,
  };
}

export function countVisibleThreadLabels(
  labeledThreads: Iterable<ThreadBlockLabel>,
): Record<ThreadBlockLabel, number> {
  const counts = emptyThreadLabelCounts();
  for (const label of labeledThreads) {
    counts[label] += 1;
  }
  return counts;
}

export function threadBlockLabelClass(label: ThreadBlockLabel): string {
  switch (label) {
    case "Public Clash":
      return "feed-conversation-thread-label--clash";
    case "Narrative Shift":
      return "feed-conversation-thread-label--narrative";
    case "Receipt Locked":
      return "feed-conversation-thread-label--receipt";
    case "Market Read":
      return "feed-conversation-thread-label--market";
    case "Desk Note":
      return "feed-conversation-thread-label--desk";
  }
}

export function threadBlockSurfaceClass(label: ThreadBlockLabel): string {
  switch (label) {
    case "Public Clash":
      return "feed-conversation-thread--rival";
    case "Receipt Locked":
      return "feed-conversation-thread--receipt";
    case "Narrative Shift":
      return "feed-conversation-thread--narrative";
    case "Market Read":
      return "feed-conversation-thread--market";
    default:
      return "feed-conversation-thread--desk";
  }
}
