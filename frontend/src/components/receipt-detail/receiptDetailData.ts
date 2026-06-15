import { DEMO_SCRY_RECEIPTS } from "@/components/users/profile/reputation/mockReceipts";
import type { ScryReceipt } from "@/components/users/profile/reputation/types";
import { enrichVerifiedCall } from "@/components/verified-calls/verifiedCallEnrichment";
import type { VerifiedCallBase } from "@/components/verified-calls/types";
import { displayReceiptId, findReceiptByRouteId, scrMatchesCanonical } from "@/lib/receiptIds";
import { fetchReceiptById, fetchReceipts } from "@/lib/receipts";
import { FALLBACK_VERIFIED_CALLS } from "@/components/verified-calls/fallbackData";
import {
  MOCK_RECEIPT_DETAILS_WITH_RELATED,
  MOCK_RECEIPT_DETAILS,
} from "./mockReceiptDetails";
import { enrichReceiptWithNetwork } from "./mockReceiptNetwork";
import type {
  ReceiptDetail,
  ReceiptDetailNetworkImpact,
  ReceiptDetailOutcome,
  ReceiptDetailRelated,
  ReceiptDetailStatus,
} from "./types";

function hash(s: string) {
  return s.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

function displayNumberFromId(id: string): string {
  const digits = id.replace(/\D/g, "");
  if (digits.length >= 3) {
    const n = parseInt(digits.slice(-4), 10);
    if (!Number.isNaN(n) && n > 0) return String(n);
  }
  const h = hash(id);
  return String(1400 + (h % 400));
}

function statusFromCall(call: VerifiedCallBase, outcome: ReceiptDetailOutcome): ReceiptDetailStatus {
  if (outcome === "pending") return "pending";
  return call.final_outcome ? "verified" : "pending";
}

function outcomeFromCall(call: VerifiedCallBase): ReceiptDetailOutcome {
  const side = call.side.toUpperCase();
  const final = call.final_outcome?.toUpperCase();
  if (!final) return "pending";
  return side === final ? "correct" : "missed";
}

function mapVerifiedCallToDetail(
  call: VerifiedCallBase,
  related: VerifiedCallBase[],
): ReceiptDetail {
  const enriched = enrichVerifiedCall(call);
  const outcome = outcomeFromCall(call);
  const credibility =
    typeof call.reputation_delta === "number"
      ? Math.round(call.reputation_delta)
      : enriched.reputation_delta;

  const resolvedAt =
    outcome === "pending"
      ? null
      : new Date(
          Date.now() - enriched.verification_delay_days * 86400000,
        ).toISOString();

  const consensusFrom = Math.round(enriched.consensus_at_time);
  const consensusTo = Math.round(enriched.final_consensus);

  const sameForecaster = related.filter((r) => r.agent_slug === call.agent_slug);
  const relatedDetails: ReceiptDetailRelated[] = sameForecaster.slice(0, 4).map((r) => {
    const o = outcomeFromCall(r);
    const delta =
      typeof r.reputation_delta === "number"
        ? Math.round(r.reputation_delta)
        : enrichVerifiedCall(r).reputation_delta;
    return {
      id: r.id,
      forecastTitle: r.market_title,
      forecasterName: r.agent_name,
      outcome: o,
      credibilityDelta: delta,
    };
  });

  const credibilityReason =
    call.reputation_reason ??
    enriched.reputation_impact_summary ??
    (outcome === "correct"
      ? "Correct forecast recorded on resolution."
      : outcome === "missed"
        ? "Incorrect forecast — credibility adjusted on resolution."
        : "Awaiting market resolution.");

  return {
    id: call.id,
    displayNumber: displayNumberFromId(call.id),
    forecastTitle: call.market_title,
    status: statusFromCall(call, outcome),
    outcome,
    credibilityDelta: credibility,
    resolvedAt,
    forecaster: {
      name: call.agent_name,
      slug: call.agent_slug,
      subjectType: call.subject_type === "user" ? "user" : "agent",
      avatarColor: call.avatar_color,
    },
    calledProbability: Math.round(call.original_probability ?? call.confidence),
    consensusAtCall: consensusFrom,
    consensusAtResolution: consensusTo,
    side: call.side.toUpperCase() === "NO" ? "NO" : "YES",
    calledAt: call.created_at,
    reasoning: call.original_take,
    networkImpact: buildNetworkImpact(consensusFrom, consensusTo, call.id, call.market_slug, call.agent_slug, outcome),
    credibilityImpact: {
      earned: credibility,
      reason: credibilityReason,
    },
    backers: [],
    challengers: [],
    timeline: [],
    related: relatedDetails,
  };
}

function buildNetworkImpact(
  consensusAtCall: number,
  consensusAtResolution: number,
  idSeed: string,
  titleSeed: string,
  slugSeed: string,
  outcome: ReceiptDetailOutcome,
): ReceiptDetailNetworkImpact {
  const backers = 1 + (hash(idSeed) % 4);
  const challengers = 1 + (hash(titleSeed) % 7);
  const h = hash(idSeed);
  const shift = consensusAtResolution - consensusAtCall;
  const credibilityDistributed =
    outcome === "correct" ? backers * 5 + challengers : -(challengers * 2) + backers;
  return {
    consensusAtCall,
    consensusAtResolution,
    consensusShift: shift,
    publicReads: 6 + (h % 18),
    backers,
    challengers,
    followersGained:
      outcome === "correct"
        ? 3 + (hash(slugSeed) % 12)
        : Math.max(0, (hash(slugSeed) % 4) - 1),
    credibilityDistributed,
  };
}

function mapScryReceiptToDetail(
  receipt: ScryReceipt,
  all: ScryReceipt[],
): ReceiptDetail {
  const mock = MOCK_RECEIPT_DETAILS.find((m) => m.id === receipt.id);
  const consensusTo =
    mock?.consensusAtResolution ??
    Math.min(92, Math.max(8, receipt.consensusAtCall + (receipt.outcome === "correct" ? 22 : -12)));

  const related = all
    .filter((r) => r.id !== receipt.id && r.outcome !== "pending")
    .slice(0, 4)
    .map((r) => ({
      id: r.id,
      forecastTitle: r.forecastTitle,
      forecasterName: r.agentOrUserName ?? "Daniel Scry",
      outcome: r.outcome,
      credibilityDelta: r.credibilityDelta,
    }));

  return {
    id: receipt.id,
    displayNumber: mock?.displayNumber ?? displayNumberFromId(receipt.id),
    forecastTitle: mock?.forecastTitle ?? receipt.forecastTitle,
    status: receipt.receiptStatus,
    outcome: receipt.outcome,
    credibilityDelta: receipt.credibilityDelta,
    resolvedAt: receipt.resolvedAt,
    forecaster: mock?.forecaster ?? {
      name: receipt.agentOrUserName ?? "Daniel Scry",
      slug: "daniel-scry",
      subjectType: "user",
      avatarColor: "#a78bfa",
    },
    calledProbability: receipt.calledProbability,
    consensusAtCall: receipt.consensusAtCall,
    consensusAtResolution: consensusTo,
    side: receipt.side,
    calledAt: receipt.calledAt,
    reasoning: mock?.reasoning ?? receipt.reasoningExcerpt,
    networkImpact:
      mock?.networkImpact ??
      buildNetworkImpact(
        receipt.consensusAtCall,
        consensusTo,
        receipt.id,
        receipt.forecastTitle,
        receipt.id,
        receipt.outcome,
      ),
    credibilityImpact: mock?.credibilityImpact ?? {
      earned: receipt.credibilityDelta,
      reason:
        receipt.outcome === "correct"
          ? "Correct forecast recorded on resolution."
          : receipt.outcome === "missed"
            ? "Incorrect forecast — credibility adjusted on resolution."
            : "Pending resolution.",
    },
    backers: mock?.backers ?? [],
    challengers: mock?.challengers ?? [],
    timeline: mock?.timeline ?? [],
    related: mock?.related.length ? mock.related : related,
  };
}

function finalizeDetail(detail: ReceiptDetail): ReceiptDetail {
  return enrichReceiptWithNetwork(detail);
}

function findMockDetail(routeId: string): ReceiptDetail | null {
  const decoded = decodeURIComponent(routeId);
  const byId = findReceiptByRouteId(MOCK_RECEIPT_DETAILS_WITH_RELATED, decoded);
  if (byId) return finalizeDetail(byId);

  const scrMatch = MOCK_RECEIPT_DETAILS_WITH_RELATED.find((r) =>
    scrMatchesCanonical(decoded, r.id),
  );
  if (scrMatch) return finalizeDetail(scrMatch);

  const demo = findReceiptByRouteId(DEMO_SCRY_RECEIPTS, decoded);
  if (demo) return finalizeDetail(mapScryReceiptToDetail(demo, DEMO_SCRY_RECEIPTS));

  if (/^\d{3,5}$/.test(decoded)) {
    const byNumber =
      MOCK_RECEIPT_DETAILS_WITH_RELATED.find((r) => r.displayNumber === decoded) ?? null;
    return byNumber ? finalizeDetail(byNumber) : null;
  }

  return null;
}

export async function resolveReceiptDetail(routeId: string): Promise<ReceiptDetail | null> {
  const mock = findMockDetail(routeId);
  if (mock) return mock;

  try {
    const all = await fetchReceipts();
    let call: VerifiedCallBase | null = await fetchReceiptById(routeId);

    if (!call && all) {
      call = findReceiptByRouteId(all.receipts, routeId) ?? null;
    }

    if (call) {
      const related =
        all?.receipts.filter(
          (r) =>
            r.id !== call!.id &&
            (r.market_slug === call!.market_slug || r.agent_slug === call!.agent_slug),
        ) ?? [];
      return finalizeDetail(mapVerifiedCallToDetail(call, related));
    }
  } catch {
    /* use offline fallbacks */
  }

  const fallback =
    findReceiptByRouteId(FALLBACK_VERIFIED_CALLS, routeId) ?? FALLBACK_VERIFIED_CALLS[0];
  const related = FALLBACK_VERIFIED_CALLS.filter((r) => r.id !== fallback.id).slice(0, 4);
  return finalizeDetail(mapVerifiedCallToDetail(fallback, related));
}

export function receiptDisplayLabel(detail: ReceiptDetail): string {
  return `Receipt #${detail.displayNumber}`;
}

export function receiptScrLabel(detail: ReceiptDetail): string {
  return displayReceiptId(detail.id);
}
