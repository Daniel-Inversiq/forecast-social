"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  loadAiQueue,
  loadStudioDrafts,
  saveAiQueue,
  saveStudioDrafts,
  seedAiQueueForAgent,
} from "@/lib/agentPublishingStorage";
import { FALLBACK_PUBLIC_READS } from "./fallbackData";
import type {
  AgentReadPosition,
  BackPublicReadPayload,
  ChallengePublicReadPayload,
  CreatePublicReadPayload,
  PostAsAgentPayload,
  PublicRead,
  ReadOrigin,
  ReasoningSource,
  StudioAiQueueItem,
  StudioReadDraft,
} from "./types";

const STORAGE_KEY = "scry-public-reads-user-v1";

type PublicReadsContextValue = {
  reads: PublicRead[];
  drafts: StudioReadDraft[];
  aiQueue: StudioAiQueueItem[];
  addRead: (payload: CreatePublicReadPayload) => PublicRead;
  publishAsAgent: (payload: PostAsAgentPayload) => PublicRead;
  updateRead: (readId: string, patch: Partial<PublicRead>) => void;
  setReadPosition: (readId: string, position: AgentReadPosition) => void;
  saveDraft: (draft: Omit<StudioReadDraft, "id" | "createdAt" | "updatedAt"> & { id?: string }) => StudioReadDraft;
  deleteDraft: (draftId: string) => void;
  publishDraft: (draftId: string, author: PostAsAgentPayload["author"]) => PublicRead | null;
  ensureAiQueue: (agentSlug: string) => void;
  approveAiDraft: (
    itemId: string,
    author: PostAsAgentPayload["author"],
    edits?: Partial<StudioAiQueueItem>,
  ) => PublicRead | null;
  rejectAiDraft: (itemId: string) => void;
  backRead: (payload: BackPublicReadPayload) => void;
  challengeRead: (payload: ChallengePublicReadPayload) => void;
};

const PublicReadsContext = createContext<PublicReadsContextValue | null>(null);

function loadUserReads(): PublicRead[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PublicRead[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveUserReads(reads: PublicRead[]) {
  if (typeof window === "undefined") return;
  const userOnly = reads.filter((r) => r.id.startsWith("read-user-"));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userOnly));
}

function mergeAll(userReads: PublicRead[], overrides: Record<string, Partial<PublicRead>>) {
  const byId = new Map<string, PublicRead>();
  for (const r of FALLBACK_PUBLIC_READS) {
    byId.set(r.id, { ...r, ...overrides[r.id] });
  }
  for (const r of userReads) {
    byId.set(r.id, { ...r, ...overrides[r.id] });
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function buildReadFromPayload(
  payload: CreatePublicReadPayload & {
    origin?: ReadOrigin;
    reasoningSource?: ReasoningSource;
    publishedByAgent?: boolean;
    agentPosition?: AgentReadPosition;
    studioLifecycle?: PublicRead["studioLifecycle"];
  },
): PublicRead {
  const author = payload.author;
  return {
    id: `read-user-${Date.now()}`,
    authorId: author?.authorId ?? "user-demo",
    authorName: author?.authorName ?? "You",
    authorHandle: author?.authorHandle ?? "you",
    authorAvatar: author?.authorAvatar ?? "#8b5cf6",
    authorTrustTier: author?.authorTrustTier ?? "observer",
    authorCredibility: author?.authorCredibility ?? 120,
    authorRankLabel: author?.authorRankLabel ?? "Observer",
    title: payload.title,
    marketOrNarrative: payload.marketOrNarrative ?? payload.title,
    side: payload.side,
    probability: payload.probability,
    thesis: payload.thesis,
    category: payload.category,
    status: "open",
    createdAt: new Date().toISOString(),
    resolvesAt: payload.resolvesAt,
    consensusAtPost: payload.probability,
    currentConsensus: payload.probability,
    backersCount: 0,
    challengersCount: 0,
    publicReadsCount: 0,
    credibilityAtStake: 15,
    potentialCredibilityDelta: 12,
    tags: payload.tags,
    origin: payload.origin,
    reasoningSource: payload.reasoningSource,
    publishedByAgent: payload.publishedByAgent,
    agentPosition: payload.agentPosition,
    studioLifecycle: payload.studioLifecycle ?? "published",
    beliefSlug: payload.beliefSlug,
    beliefTitle: payload.beliefTitle,
  };
}

export function PublicReadsProvider({ children }: { children: ReactNode }) {
  const [userReads, setUserReads] = useState<PublicRead[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Partial<PublicRead>>>({});
  const [drafts, setDrafts] = useState<StudioReadDraft[]>([]);
  const [aiQueue, setAiQueue] = useState<StudioAiQueueItem[]>([]);

  useEffect(() => {
    setUserReads(loadUserReads());
    setDrafts(loadStudioDrafts());
    setAiQueue(loadAiQueue());
  }, []);

  const reads = useMemo(() => mergeAll(userReads, overrides), [userReads, overrides]);

  const persistReads = useCallback((next: PublicRead[]) => {
    setUserReads(next);
    saveUserReads(next);
  }, []);

  const addRead = useCallback((payload: CreatePublicReadPayload): PublicRead => {
    const read = buildReadFromPayload({
      ...payload,
      origin: payload.author ? "creator" : undefined,
      publishedByAgent: Boolean(payload.author),
    });
    setUserReads((prev) => {
      const next = [read, ...prev];
      saveUserReads(next);
      return next;
    });
    return read;
  }, []);

  const publishAsAgent = useCallback((payload: PostAsAgentPayload): PublicRead => {
    const read = buildReadFromPayload({
      ...payload,
      author: payload.author,
      origin: "creator",
      reasoningSource: payload.reasoningSource ?? "creator_written",
      publishedByAgent: true,
      agentPosition: payload.position,
      studioLifecycle: "published",
    });
    setUserReads((prev) => {
      const next = [read, ...prev];
      saveUserReads(next);
      return next;
    });
    return read;
  }, []);

  const updateRead = useCallback(
    (readId: string, patch: Partial<PublicRead>) => {
      setUserReads((prev) => {
        const idx = prev.findIndex((r) => r.id === readId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...patch };
          saveUserReads(next);
          return next;
        }
        return prev;
      });
      setOverrides((prev) => ({
        ...prev,
        [readId]: { ...prev[readId], ...patch },
      }));
    },
    [],
  );

  const setReadPosition = useCallback(
    (readId: string, position: AgentReadPosition) => {
      updateRead(readId, { agentPosition: position });
    },
    [updateRead],
  );

  const saveDraft = useCallback(
    (
      input: Omit<StudioReadDraft, "id" | "createdAt" | "updatedAt"> & { id?: string },
    ): StudioReadDraft => {
      const now = new Date().toISOString();
      const draft: StudioReadDraft = {
        id: input.id ?? `draft-${Date.now()}`,
        agentSlug: input.agentSlug,
        title: input.title,
        category: input.category,
        side: input.side,
        probability: input.probability,
        thesis: input.thesis,
        resolvesAt: input.resolvesAt,
        tags: input.tags,
        marketOrNarrative: input.marketOrNarrative,
        position: input.position,
        createdAt: input.id
          ? drafts.find((d) => d.id === input.id)?.createdAt ?? now
          : now,
        updatedAt: now,
      };
      setDrafts((prev) => {
        const without = prev.filter((d) => d.id !== draft.id);
        const next = [draft, ...without];
        saveStudioDrafts(next);
        return next;
      });
      return draft;
    },
    [drafts],
  );

  const deleteDraft = useCallback((draftId: string) => {
    setDrafts((prev) => {
      const next = prev.filter((d) => d.id !== draftId);
      saveStudioDrafts(next);
      return next;
    });
  }, []);

  const publishDraft = useCallback(
    (draftId: string, author: PostAsAgentPayload["author"]): PublicRead | null => {
      const draft = drafts.find((d) => d.id === draftId);
      if (!draft) return null;
      const read = publishAsAgent({
        title: draft.title,
        category: draft.category,
        side: draft.side,
        probability: draft.probability,
        thesis: draft.thesis,
        resolvesAt: draft.resolvesAt,
        tags: draft.tags,
        marketOrNarrative: draft.marketOrNarrative ?? draft.title,
        reasoningSource: draft.reasoningSource,
        position: draft.position,
        author,
      });
      deleteDraft(draftId);
      return read;
    },
    [drafts, publishAsAgent, deleteDraft],
  );

  const ensureAiQueue = useCallback((agentSlug: string) => {
    setAiQueue((prev) => {
      const hasForAgent = prev.some(
        (q) => q.agentSlug === agentSlug && q.status === "pending",
      );
      if (hasForAgent) return prev;
      const seeded = seedAiQueueForAgent(agentSlug);
      const next = [...seeded, ...prev.filter((q) => q.agentSlug !== agentSlug || q.status !== "pending")];
      saveAiQueue(next);
      return next;
    });
  }, []);

  const approveAiDraft = useCallback(
    (
      itemId: string,
      author: PostAsAgentPayload["author"],
      edits?: Partial<StudioAiQueueItem>,
    ): PublicRead | null => {
      const item = aiQueue.find((q) => q.id === itemId);
      if (!item) return null;
      const merged = { ...item, ...edits };
      const hadEdits =
        edits &&
        (edits.title != null ||
          edits.thesis != null ||
          edits.probability != null ||
          edits.side != null);
      const reasoningSource: ReasoningSource = hadEdits
        ? "ai_creator_edited"
        : merged.reasoningSource ?? "ai_generated";
      const read = buildReadFromPayload({
        title: merged.title,
        category: merged.category,
        side: merged.side,
        probability: merged.probability,
        thesis: merged.thesis,
        resolvesAt: merged.resolvesAt,
        tags: merged.tags,
        marketOrNarrative: merged.marketOrNarrative ?? merged.title,
        author,
        origin: "ai_approved",
        reasoningSource,
        publishedByAgent: true,
        agentPosition: merged.position,
        studioLifecycle: "published",
      });

      setUserReads((prev) => {
        const next = [read, ...prev];
        saveUserReads(next);
        return next;
      });
      setAiQueue((prev) => {
        const next = prev.filter((q) => q.id !== itemId);
        saveAiQueue(next);
        return next;
      });
      return read;
    },
    [aiQueue],
  );

  const rejectAiDraft = useCallback((itemId: string) => {
    setAiQueue((prev) => {
      const next = prev.map((q) =>
        q.id === itemId ? { ...q, status: "rejected" as const } : q,
      );
      saveAiQueue(next);
      return next;
    });
  }, []);

  const backRead = useCallback(
    (payload: BackPublicReadPayload) => {
      setOverrides((prev) => {
        const base = reads.find((r) => r.id === payload.readId);
        if (!base) return prev;
        return {
          ...prev,
          [payload.readId]: {
            status: base.status === "open" ? "backed" : base.status,
            backersCount: base.backersCount + 1,
            userBacked: true,
            studioLifecycle: base.studioLifecycle === "published" ? "backing" : base.studioLifecycle,
          },
        };
      });
    },
    [reads],
  );

  const challengeRead = useCallback(
    (payload: ChallengePublicReadPayload) => {
      setOverrides((prev) => {
        const base = reads.find((r) => r.id === payload.readId);
        if (!base) return prev;
        return {
          ...prev,
          [payload.readId]: {
            status: "challenged",
            challengersCount: base.challengersCount + 1,
            publicReadsCount: base.publicReadsCount + 1,
            userChallenged: true,
          },
        };
      });
    },
    [reads],
  );

  const value = useMemo(
    () => ({
      reads,
      drafts,
      aiQueue,
      addRead,
      publishAsAgent,
      updateRead,
      setReadPosition,
      saveDraft,
      deleteDraft,
      publishDraft,
      ensureAiQueue,
      approveAiDraft,
      rejectAiDraft,
      backRead,
      challengeRead,
    }),
    [
      reads,
      drafts,
      aiQueue,
      addRead,
      publishAsAgent,
      updateRead,
      setReadPosition,
      saveDraft,
      deleteDraft,
      publishDraft,
      ensureAiQueue,
      approveAiDraft,
      rejectAiDraft,
      backRead,
      challengeRead,
    ],
  );

  return (
    <PublicReadsContext.Provider value={value}>{children}</PublicReadsContext.Provider>
  );
}

export function usePublicReads() {
  const ctx = useContext(PublicReadsContext);
  if (!ctx) {
    throw new Error("usePublicReads must be used within PublicReadsProvider");
  }
  return ctx;
}
