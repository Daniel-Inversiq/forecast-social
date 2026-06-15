import type { PulseEvent } from "@/components/LivePulsePanel";
import type { VerifiedCallBase } from "@/components/verified-calls/types";
import { FALLBACK_VERIFIED_CALLS } from "@/components/verified-calls/fallbackData";
import { fetchReceipts } from "@/lib/receipts";

export const MIN_RECENT_RECEIPTS = 3;

export type RecentReceiptItem = {
  id: string;
  agentName: string;
  agentSlug: string;
  forecastTitle: string;
  correct: boolean;
  credibilityDelta: number;
  href: string;
};

/** Always-on proof loop — matches home sidebar examples when API/pulse are quiet. */
export const CURATED_RECENT_RECEIPTS: RecentReceiptItem[] = [
  {
    id: "curated-bullbot-nvda",
    agentName: "BullBot",
    agentSlug: "bullbot",
    forecastTitle: "NVDA beats earnings",
    correct: true,
    credibilityDelta: 14,
    href: "/verified-calls",
  },
  {
    id: "curated-macro-oracle-fed",
    agentName: "Macro Oracle",
    agentSlug: "macro-oracle",
    forecastTitle: "Fed cuts before June",
    correct: false,
    credibilityDelta: -11,
    href: "/verified-calls",
  },
  {
    id: "curated-fedwatcher-oil",
    agentName: "FedWatcher",
    agentSlug: "fed-watcher",
    forecastTitle: "Oil above $100",
    correct: true,
    credibilityDelta: 9,
    href: "/verified-calls",
  },
];

export function receiptFromVerifiedCall(call: VerifiedCallBase): RecentReceiptItem {
  const correct = call.final_outcome === call.side;
  const raw = call.reputation_delta;
  const credibilityDelta =
    raw != null
      ? Math.round(raw)
      : correct
        ? 8 + (call.confidence % 9)
        : -(6 + (call.confidence % 8));

  return {
    id: call.id,
    agentName: call.agent_name,
    agentSlug: call.agent_slug,
    forecastTitle: call.market_title,
    correct,
    credibilityDelta,
    href: `/receipts/${call.id}`,
  };
}

export function receiptFromPulseEvent(event: PulseEvent): RecentReceiptItem | null {
  if (event.type !== "receipt_verified" || !event.related_agent) return null;

  const titleLower = `${event.title} ${event.body}`.toLowerCase();
  const correct =
    !titleLower.includes("wrong") &&
    !titleLower.includes("miss") &&
    !titleLower.includes("incorrect");

  const deltaMatch = `${event.title} ${event.body}`.match(/([+-]\d+)/);
  const credibilityDelta = deltaMatch
    ? parseInt(deltaMatch[1], 10)
    : correct
      ? 10 + (event.intensity % 6)
      : -(8 + (event.intensity % 5));

  const cleanedTitle = event.title
    .replace(/^.*receipt\s+(archived|verified)?\s*/i, "")
    .replace(/\s+\$[+-]\d+.*$/i, "")
    .trim();

  const forecastTitle =
    event.related_market?.title ?? (cleanedTitle || event.title);

  return {
    id: `pulse-${event.related_agent.slug}-${event.timestamp}`,
    agentName: event.related_agent.name,
    agentSlug: event.related_agent.slug,
    forecastTitle,
    correct,
    credibilityDelta,
    href: `/agents/${event.related_agent.slug}`,
  };
}

export function mergeRecentReceipts(
  sources: RecentReceiptItem[],
  min = MIN_RECENT_RECEIPTS,
  max = 5,
): RecentReceiptItem[] {
  const seen = new Set<string>();
  const out: RecentReceiptItem[] = [];

  const push = (item: RecentReceiptItem) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    out.push(item);
  };

  for (const item of sources) push(item);
  for (const item of CURATED_RECENT_RECEIPTS) {
    if (out.length >= min) break;
    push(item);
  }
  if (out.length < min) {
    for (const call of FALLBACK_VERIFIED_CALLS.map(receiptFromVerifiedCall)) {
      if (out.length >= min) break;
      push(call);
    }
  }

  return out.slice(0, Math.max(min, max));
}

export function receiptsFromPulse(pulse: {
  new_receipts?: PulseEvent[];
  latest_events?: PulseEvent[];
} | null): RecentReceiptItem[] {
  if (!pulse) return [];
  const events = [
    ...(pulse.new_receipts ?? []),
    ...(pulse.latest_events?.filter((e) => e.type === "receipt_verified") ?? []),
  ];
  return events
    .map(receiptFromPulseEvent)
    .filter((r): r is RecentReceiptItem => r != null);
}

export async function loadRecentReceiptsFromApi(): Promise<RecentReceiptItem[]> {
  const data = await fetchReceipts();
  const fromApi = (data?.receipts ?? []).map(receiptFromVerifiedCall);
  return mergeRecentReceipts(fromApi);
}

export function resolveRecentReceipts(
  apiReceipts: RecentReceiptItem[],
  pulse: { new_receipts?: PulseEvent[]; latest_events?: PulseEvent[] } | null,
): RecentReceiptItem[] {
  return mergeRecentReceipts([...apiReceipts, ...receiptsFromPulse(pulse)]);
}

export function formatCredibilityDelta(delta: number): string {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta} credibility`;
}
