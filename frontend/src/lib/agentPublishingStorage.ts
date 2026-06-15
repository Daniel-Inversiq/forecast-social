import type { StudioAiQueueItem, StudioReadDraft } from "@/components/public-reads/types";

const DRAFTS_KEY = "scry-studio-read-drafts-v1";
const AI_QUEUE_KEY = "scry-studio-ai-queue-v1";

function loadJson<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveJson<T>(key: string, items: T[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(items));
}

export function loadStudioDrafts(): StudioReadDraft[] {
  return loadJson<StudioReadDraft>(DRAFTS_KEY);
}

export function saveStudioDrafts(drafts: StudioReadDraft[]) {
  saveJson(DRAFTS_KEY, drafts);
}

export function loadAiQueue(): StudioAiQueueItem[] {
  return loadJson<StudioAiQueueItem>(AI_QUEUE_KEY);
}

export function saveAiQueue(items: StudioAiQueueItem[]) {
  saveJson(AI_QUEUE_KEY, items);
}

const daysFromNow = (d: number) =>
  new Date(Date.now() + d * 86_400_000).toISOString();

/** Seed demo AI drafts for an agent when queue is empty. */
export function seedAiQueueForAgent(agentSlug: string): StudioAiQueueItem[] {
  const templates = [
    {
      title: "Fed cut before September — labor stays sticky",
      category: "Macro" as const,
      side: "NO" as const,
      probability: 72,
      thesis:
        "Payrolls and wage growth prints suggest the FOMC will delay easing until Q4. Market is overpricing a September cut.",
      marketOrNarrative: "Fed cut by Sep 2026",
      tags: ["fed", "rates"],
    },
    {
      title: "ETH outperforms BTC through Q3 on L2 fee burn",
      category: "Crypto" as const,
      side: "YES" as const,
      probability: 61,
      thesis:
        "Blob fee dynamics and staking yield compression favor ETH beta in a range-bound BTC tape.",
      marketOrNarrative: "ETH/BTC ratio Q3",
      tags: ["eth", "crypto"],
    },
    {
      title: "Major AI lab ships public benchmark beat before December",
      category: "AI" as const,
      side: "YES" as const,
      probability: 64,
      thesis:
        "Hiring velocity and compute procurement patterns align with a Q4 capability disclosure.",
      marketOrNarrative: "AI breakthrough 2026",
      tags: ["ai", "frontier"],
    },
  ];

  const now = Date.now();
  return templates.map((t, i) => ({
    id: `ai-draft-${agentSlug}-${i}`,
    agentSlug,
    ...t,
    resolvesAt: daysFromNow(60 + i * 15),
    generatedAt: new Date(now - (i + 1) * 3_600_000).toISOString(),
    status: "pending" as const,
    reasoningSource: "ai_generated" as const,
  }));
}
