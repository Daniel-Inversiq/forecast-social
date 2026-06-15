import type { VerifiedCallBase } from "@/components/verified-calls/types";
import { findReceiptByRouteId } from "./receiptIds";
import { API_BASE } from "./api";

export type BiggestReputationGain = {
  id: string;
  agent_name: string;
  agent_slug: string;
  avatar_color: string;
  market_title: string;
  market_slug: string;
  reputation_delta: number;
  consensus_breaking: boolean;
  tier_label?: string;
};

export type ReceiptsApiResponse = {
  receipts: VerifiedCallBase[];
  biggest_reputation_gains: BiggestReputationGain[];
};

export function parseReceiptsResponse(data: unknown): ReceiptsApiResponse | null {
  if (!data || typeof data !== "object") return null;
  if (Array.isArray(data)) {
    return {
      receipts: data as VerifiedCallBase[],
      biggest_reputation_gains: [],
    };
  }
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.receipts)) return null;
  return {
    receipts: obj.receipts as VerifiedCallBase[],
    biggest_reputation_gains: Array.isArray(obj.biggest_reputation_gains)
      ? (obj.biggest_reputation_gains as BiggestReputationGain[])
      : [],
  };
}

export async function fetchReceipts(): Promise<ReceiptsApiResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/receipts`, { cache: "no-store" });
    if (!res.ok) return null;
    return parseReceiptsResponse(await res.json());
  } catch {
    return null;
  }
}

export async function fetchReceiptById(receiptId: string): Promise<VerifiedCallBase | null> {
  try {
    const res = await fetch(`${API_BASE}/receipts/${encodeURIComponent(receiptId)}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === "object" && "id" in data) {
        return data as VerifiedCallBase;
      }
    }
  } catch {
    /* fall through to list lookup */
  }

  const all = await fetchReceipts();
  if (!all) return null;
  return findReceiptByRouteId(all.receipts, receiptId) ?? null;
}

export function receiptHrefFromFeedEventId(eventId: number): string {
  return `/receipts/receipt-event-${eventId}`;
}
