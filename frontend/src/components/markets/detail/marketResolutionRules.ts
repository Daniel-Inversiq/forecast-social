import type { EnrichedMarketDetail } from "./types";

export type MarketResolutionRules = {
  condition: string;
  source: string;
  authority: string;
  reviewStatus: "verified" | "pending";
  yesCriteria: string[];
  noCriteria: string[];
  edgeCases: string[];
  primarySource: string;
  secondarySource: string;
};

function hash(s: string) {
  return s.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

function horizonLabel(market: EnrichedMarketDetail): string {
  const h = market.resolution_horizon;
  if (!h?.label) return "at market close on the resolution date";
  return h.label.toLowerCase();
}

function categoryTemplates(
  market: EnrichedMarketDetail,
): Omit<MarketResolutionRules, "reviewStatus"> {
  const title = market.title;
  const cat = market.category;
  const when = horizonLabel(market);
  const apiSource = market.resolution_source?.trim();

  if (/brent|crude|oil|wti/i.test(title)) {
    const threshold = "$100.00";
    return {
      condition: `Resolves YES if Brent Crude settles above ${threshold} ${when}.`,
      source: apiSource ?? "ICE Brent Settlement Price",
      authority: "SCRY Market Oracle",
      yesCriteria: [
        `Brent Crude closes above ${threshold}`,
        "Settlement source available",
        "Official publication confirmed",
      ],
      noCriteria: [
        `Brent Crude closes at or below ${threshold}`,
        "Settlement source unavailable and fallback source confirms below threshold",
      ],
      edgeCases: ["Market holidays", "Data revisions", "Exceptional events"],
      primarySource: apiSource ?? "ICE Brent Settlement Price",
      secondarySource: "Bloomberg commodity settlement data",
    };
  }

  if (cat === "Macro" || /recession|gdp|inflation|fed|rate/i.test(title)) {
    return {
      condition: `Resolves YES if official macro data confirms the stated outcome for “${title}” ${when}.`,
      source: apiSource ?? "Bureau of Economic Analysis / Federal Reserve releases",
      authority: "SCRY Market Oracle",
      yesCriteria: [
        "Primary government or central-bank series confirms YES threshold",
        "Release timestamp falls within the resolution window",
        "No conflicting revision supersedes the initial print",
      ],
      noCriteria: [
        "Official series fails to meet YES threshold",
        "Resolution window closes without a qualifying release",
        "Fallback consensus source confirms NO under oracle policy",
      ],
      edgeCases: ["Data revisions", "Delayed prints", "Methodology changes"],
      primarySource: apiSource ?? "BEA / Federal Reserve official releases",
      secondarySource: "Bloomberg economic calendar consensus",
    };
  }

  if (cat === "Equities" || /nvda|earnings|beat|eps|revenue/i.test(title)) {
    return {
      condition: `Resolves YES if the company reports results that meet or exceed the market’s stated threshold for “${title}” ${when}.`,
      source: apiSource ?? "SEC filing / company earnings release",
      authority: "SCRY Market Oracle",
      yesCriteria: [
        "Reported metric meets or exceeds the stated beat threshold",
        "Figure taken from the official earnings release or 10-Q/10-K",
        "Comparable basis matches the market definition (GAAP vs adjusted as specified)",
      ],
      noCriteria: [
        "Reported metric misses the stated threshold",
        "Earnings cancelled or materially restated before resolution",
        "Oracle cannot verify figures from primary filings",
      ],
      edgeCases: ["Pre-announcements", "Guidance-only updates", "Restatements"],
      primarySource: apiSource ?? "Company earnings release & SEC filings",
      secondarySource: "Refinitiv / Bloomberg earnings actuals",
    };
  }

  if (cat === "Sports" || /win|champion|playoff|injury/i.test(title)) {
    return {
      condition: `Resolves YES if the sporting outcome described in “${title}” occurs ${when}.`,
      source: apiSource ?? "Official league box score & injury report",
      authority: "SCRY Market Oracle",
      yesCriteria: [
        "Official league result confirms the YES outcome",
        "Participant listed in market rules is active per official status",
        "Game completed without void or forfeit overturning the result",
      ],
      noCriteria: [
        "Official result contradicts YES outcome",
        "Event postponed beyond resolution window without YES trigger",
        "Voided contest per league policy",
      ],
      edgeCases: ["Postponements", "Forfeits", "Stat corrections"],
      primarySource: apiSource ?? "League official results feed",
      secondarySource: "Associated Press game reports",
    };
  }

  const h = hash(market.slug);
  const threshold = 50 + (h % 15);
  return {
    condition: `Resolves YES if consensus-verified evidence supports the YES thesis for “${title}” ${when} (oracle threshold: ${threshold}% implied confidence band).`,
    source: apiSource ?? "SCRY verified source bundle",
    authority: "SCRY Market Oracle",
    yesCriteria: [
      "Primary resolution source publishes confirming data",
      "Oracle cross-check passes integrity review",
      "No active dispute flag on the market",
    ],
    noCriteria: [
      "Primary source fails to confirm YES",
      "Fallback sources align on NO under oracle policy",
      "Market voided for ambiguity per integrity rules",
    ],
    edgeCases: ["Source outages", "Conflicting headlines", "Late-breaking revisions"],
    primarySource: apiSource ?? "SCRY verified source bundle",
    secondarySource: "Editorial consensus & agent-verified receipts",
  };
}

export function buildMarketResolutionRules(
  market: EnrichedMarketDetail,
): MarketResolutionRules {
  const base = categoryTemplates(market);
  const verified =
    market.resolution_source != null ||
    market.status === "resolved" ||
    market.slug in ["us-recession-by-q4", "nvda-q2-beat"];

  return {
    ...base,
    reviewStatus: verified ? "verified" : "pending",
  };
}
