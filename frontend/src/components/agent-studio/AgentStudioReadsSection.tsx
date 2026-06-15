"use client";

import { useEffect, useMemo, useState } from "react";
import type { EnrichedAgentProfile } from "@/components/agents/profile/types";
import { ForecastThesisLine } from "@/components/forecast/ForecastThesisLine";
import {
  formatConvictionLine,
  formatPublicReadThesis,
  matchesStudioPerformanceFilter,
  readsForAuthor,
} from "@/components/public-reads/publicReadEnrichment";
import { usePublicReads } from "@/components/public-reads/PublicReadsProvider";
import type {
  PublicRead,
  StudioAiQueueItem,
  StudioReadDraft,
  StudioReadsPerformanceFilter,
  StudioReadsTabKey,
} from "@/components/public-reads/types";
import { receiptDetailPath } from "@/lib/receiptIds";
import Link from "next/link";
import { PostAsAgentModal } from "./PostAsAgentModal";
import { PlacePositionModal } from "./PlacePositionModal";
import { StudioReadLifecycle } from "./StudioReadLifecycle";
import { StudioReadBusinessCard } from "./StudioReadBusinessCard";
import { authorDefaultsFromProfile } from "./agentStudioAuthor";
import { ConvictionField, ReadModalShell, READ_CATEGORIES } from "@/components/public-reads/ReadModalShell";
import type { PublicReadCategory, PublicReadSide } from "@/components/public-reads/types";

const TABS: { key: StudioReadsTabKey; label: string }[] = [
  { key: "published", label: "Published" },
  { key: "drafts", label: "Drafts" },
  { key: "ai_queue", label: "AI Queue" },
  { key: "resolved", label: "Resolved" },
  { key: "receipts", label: "Receipts" },
];

const PERFORMANCE_FILTERS: { key: StudioReadsPerformanceFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "creator_written", label: "Creator Written" },
  { key: "ai_generated", label: "AI Generated" },
  { key: "ai_approved", label: "AI Approved" },
];

function AiQueueCard({
  item,
  onApprove,
  onEdit,
  onReject,
}: {
  item: StudioAiQueueItem;
  onApprove: () => void;
  onEdit: () => void;
  onReject: () => void;
}) {
  return (
    <article className="rounded-xl border border-cyan-500/20 bg-gradient-to-br from-zinc-950 to-cyan-950/20 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[9px] uppercase tracking-wider text-cyan-400/90 font-medium">
            AI draft
          </span>
          <h3 className="text-sm font-medium text-zinc-100 mt-1 leading-snug">{item.title}</h3>
          <ForecastThesisLine
            input={{
              thesis: item.thesis,
              title: item.title,
              marketOrNarrative: item.marketOrNarrative ?? item.title,
              probability: item.probability,
              category: item.category,
              side: item.side,
            }}
            className="mt-1"
          />
          <p className="text-[10px] text-zinc-500 mt-0.5">{item.marketOrNarrative}</p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-rose-200/95">
          {formatConvictionLine(item.probability, item.side)}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onApprove}
          className="min-h-[36px] px-3 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-semibold"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="min-h-[36px] px-3 rounded-lg border border-violet-500/40 text-violet-200 text-xs font-semibold hover:bg-violet-500/10"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onReject}
          className="min-h-[36px] px-3 rounded-lg border border-zinc-700 text-zinc-400 text-xs font-medium hover:border-rose-500/40 hover:text-rose-300"
        >
          Reject
        </button>
      </div>
    </article>
  );
}

function DraftCard({
  draft,
  onPublish,
  onEdit,
  onDelete,
}: {
  draft: StudioReadDraft;
  onPublish: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-2">
      <h3 className="text-sm font-medium text-zinc-200">{draft.title || "Untitled draft"}</h3>
      {draft.thesis.trim() && (
        <ForecastThesisLine
          input={{
            thesis: draft.thesis,
            title: draft.title,
            marketOrNarrative: draft.marketOrNarrative,
            probability: draft.probability,
            category: draft.category,
            side: draft.side,
          }}
          className="mt-1"
        />
      )}
      <p className="text-[10px] text-zinc-500 tabular-nums">
        {formatConvictionLine(draft.probability, draft.side)} · {draft.category}
      </p>
      {draft.position && (
        <p className="text-[10px] text-cyan-400/80">
          Position · {draft.position.side} · {draft.position.convictionPercent}% conviction
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={onPublish}
          className="text-xs font-semibold text-violet-400 hover:text-violet-300"
        >
          Publish draft
        </button>
        <button type="button" onClick={onEdit} className="text-xs text-zinc-400 hover:text-zinc-200">
          Edit
        </button>
        <button type="button" onClick={onDelete} className="text-xs text-zinc-500 hover:text-rose-400">
          Delete
        </button>
      </div>
    </article>
  );
}

function EditAiDraftModal({
  item,
  open,
  onClose,
  onSave,
}: {
  item: StudioAiQueueItem | null;
  open: boolean;
  onClose: () => void;
  onSave: (edits: Partial<StudioAiQueueItem>) => void;
}) {
  const [title, setTitle] = useState("");
  const [thesis, setThesis] = useState("");
  const [probability, setProbability] = useState("55");
  const [side, setSide] = useState<PublicReadSide>("YES");

  useEffect(() => {
    if (!item || !open) return;
    setTitle(item.title);
    setThesis(item.thesis);
    setProbability(String(item.probability));
    setSide(item.side);
  }, [item, open]);

  if (!item) return null;

  return (
    <ReadModalShell open={open} onClose={onClose} title="Edit AI draft" subtitle="Changes publish as agent on approve">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const prob = Number(probability);
          if (!title.trim() || prob < 1 || prob > 99) return;
          onSave({ title: title.trim(), thesis: thesis.trim(), probability: prob, side });
          onClose();
        }}
        className="space-y-3"
      >
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full h-10 rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 text-sm text-zinc-100"
          />
        </label>
        <ConvictionField value={probability} onChange={setProbability} side={side} />
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Thesis</span>
          <textarea
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 resize-none"
          />
        </label>
        <button
          type="submit"
          className="w-full min-h-[44px] rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold"
        >
          Save & publish as agent
        </button>
      </form>
    </ReadModalShell>
  );
}

function DraftEditorModal({
  profile,
  draft,
  open,
  onClose,
}: {
  profile: EnrichedAgentProfile;
  draft: StudioReadDraft | null;
  open: boolean;
  onClose: () => void;
}) {
  const { saveDraft } = usePublicReads();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<PublicReadCategory>("Macro");
  const [side, setSide] = useState<PublicReadSide>("YES");
  const [probability, setProbability] = useState("55");
  const [thesis, setThesis] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(draft?.title ?? "");
    setCategory(draft?.category ?? "Macro");
    setSide(draft?.side ?? "YES");
    setProbability(String(draft?.probability ?? 55));
    setThesis(draft?.thesis ?? "");
  }, [open, draft]);

  return (
    <ReadModalShell open={open} onClose={onClose} title={draft ? "Edit draft" : "New draft"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveDraft({
            id: draft?.id,
            agentSlug: profile.slug,
            title: title.trim(),
            category,
            side,
            probability: Number(probability),
            thesis: thesis.trim(),
            tags: draft?.tags ?? [],
          });
          onClose();
        }}
        className="space-y-3"
      >
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="mt-1 w-full h-10 rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 text-sm text-zinc-100"
          />
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as PublicReadCategory)}
          className="w-full h-10 rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-2 text-sm text-zinc-100"
        >
          {READ_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <ConvictionField value={probability} onChange={setProbability} side={side} />
        <textarea
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 resize-none"
        />
        <button
          type="submit"
          className="w-full min-h-[44px] rounded-lg border border-zinc-600 text-zinc-200 text-sm font-semibold hover:bg-zinc-800/80"
        >
          Save draft
        </button>
      </form>
    </ReadModalShell>
  );
}

export function AgentStudioReadsSection({ profile }: { profile: EnrichedAgentProfile }) {
  const {
    reads,
    drafts,
    aiQueue,
    ensureAiQueue,
    approveAiDraft,
    rejectAiDraft,
    publishDraft,
    deleteDraft,
  } = usePublicReads();

  const [tab, setTab] = useState<StudioReadsTabKey>("published");
  const [positionRead, setPositionRead] = useState<PublicRead | null>(null);
  const [editAiItem, setEditAiItem] = useState<StudioAiQueueItem | null>(null);
  const [editDraft, setEditDraft] = useState<StudioReadDraft | null | undefined>(undefined);
  const [postOpen, setPostOpen] = useState(false);
  const [performanceFilter, setPerformanceFilter] = useState<StudioReadsPerformanceFilter>("all");

  const author = authorDefaultsFromProfile(profile);

  useEffect(() => {
    ensureAiQueue(profile.slug);
  }, [ensureAiQueue, profile.slug]);

  const authorReads = useMemo(
    () => readsForAuthor(reads, profile.slug),
    [reads, profile.slug],
  );

  const agentDrafts = useMemo(
    () => drafts.filter((d) => d.agentSlug === profile.slug),
    [drafts, profile.slug],
  );

  const pendingAi = useMemo(
    () => aiQueue.filter((q) => q.agentSlug === profile.slug && q.status === "pending"),
    [aiQueue, profile.slug],
  );

  const tabCounts = useMemo(
    () => ({
      published: authorReads.filter((r) => r.status !== "resolved").length,
      drafts: agentDrafts.length,
      ai_queue: pendingAi.length,
      resolved: authorReads.filter((r) => r.status === "resolved").length,
      receipts: authorReads.filter((r) => r.receiptId || r.studioLifecycle === "receipt").length,
    }),
    [authorReads, agentDrafts, pendingAi],
  );

  const publishedList = useMemo(
    () =>
      authorReads
        .filter((r) => r.status !== "resolved")
        .filter((r) => matchesStudioPerformanceFilter(r, performanceFilter)),
    [authorReads, performanceFilter],
  );
  const resolvedList = authorReads.filter((r) => r.status === "resolved");
  const receiptList = authorReads.filter((r) => r.receiptId || r.status === "resolved");

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Forecast desk</h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Track position-backed conviction, reads, receipts, and reputation for{" "}
            {profile.name}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPostOpen(true)}
          className="text-[11px] text-violet-400 hover:text-violet-300 font-semibold self-start sm:self-auto"
        >
          + New Read
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto feed-scroll-x scrollbar-none border-b border-zinc-800/60 pb-px">
        {TABS.map((t) => {
          const count = tabCounts[t.key];
          const label =
            t.key === "ai_queue" && count > 0 ? `${t.label} (${count})` : t.label;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`shrink-0 px-3 py-2 text-[11px] font-medium border-b-2 transition -mb-px ${
                tab === t.key
                  ? "border-violet-500 text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === "published" && (
        <div className="space-y-3">
          <div className="flex gap-1 overflow-x-auto feed-scroll-x scrollbar-none">
            {PERFORMANCE_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setPerformanceFilter(f.key)}
                className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-medium border transition ${
                  performanceFilter === f.key
                    ? "border-violet-500/50 bg-violet-500/15 text-violet-100"
                    : "border-zinc-800 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {publishedList.length === 0 ? (
            <EmptyState
              title="No published reads yet"
              message="Published reads are your public conviction track record and your fastest path to credibility."
              ctaLabel="Publish First Read"
              onCta={() => setPostOpen(true)}
            />
          ) : (
            publishedList.map((read) => (
              <div key={read.id} className="space-y-1.5">
                <StudioReadLifecycle read={read} compact />
                <StudioReadBusinessCard
                  read={read}
                  agentSlug={profile.slug}
                  onPlacePosition={() => setPositionRead(read)}
                />
              </div>
            ))
          )}
        </div>
      )}

      {tab === "drafts" && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setEditDraft(null)}
            className="text-xs text-violet-400 hover:text-violet-300 font-medium"
          >
            + Save new draft
          </button>
          {agentDrafts.length === 0 ? (
            <EmptyState
              title="No drafts yet"
              message="Drafts are where you shape your thesis before posting. Faster iteration improves signal quality."
              ctaLabel="Create First Draft"
              onCta={() => setEditDraft(null)}
            />
          ) : (
            agentDrafts.map((draft) => (
              <DraftCard
                key={draft.id}
                draft={draft}
                onPublish={() => publishDraft(draft.id, author)}
                onEdit={() => setEditDraft(draft)}
                onDelete={() => deleteDraft(draft.id)}
              />
            ))
          )}
        </div>
      )}

      {tab === "ai_queue" && (
        <div className="space-y-3">
          <p className="text-[11px] text-zinc-500 border border-cyan-500/15 rounded-lg px-3 py-2 bg-cyan-950/15">
            AI handles scale. You provide judgment — approve, edit, or reject each draft.
          </p>
          {pendingAi.length === 0 ? (
            <EmptyState
              title="No AI drafts yet"
              message="AI drafts help you scale output while keeping your judgment in control."
              ctaLabel="Generate AI Draft"
              onCta={() => ensureAiQueue(profile.slug)}
            />
          ) : (
            pendingAi.map((item) => (
              <AiQueueCard
                key={item.id}
                item={item}
                onApprove={() => approveAiDraft(item.id, author)}
                onEdit={() => setEditAiItem(item)}
                onReject={() => rejectAiDraft(item.id)}
              />
            ))
          )}
        </div>
      )}

      {tab === "resolved" && (
        <div className="space-y-3">
          {resolvedList.length === 0 ? (
            <EmptyState
              title="No resolved reads yet"
              message="Resolved reads are how this desk proves calibration and earns durable rank."
              ctaLabel="Publish Read That Can Resolve"
              onCta={() => setPostOpen(true)}
            />
          ) : (
            resolvedList.map((read) => (
              <div key={read.id} className="space-y-1.5">
                <StudioReadLifecycle read={read} />
                <StudioReadBusinessCard read={read} agentSlug={profile.slug} />
              </div>
            ))
          )}
        </div>
      )}

      {tab === "receipts" && (
        <div className="space-y-3">
          {receiptList.length === 0 ? (
            <EmptyState
              title="No receipts yet"
              message="Receipts are permanent proof from resolved reads. They are the strongest trust signal on SCRY."
              ctaLabel="Publish Read That Can Resolve"
              onCta={() => setPostOpen(true)}
            />
          ) : (
            receiptList.map((read) => (
              <article
                key={read.id}
                className="rounded-xl border border-violet-500/25 bg-violet-950/20 p-4"
              >
                <StudioReadLifecycle read={read} compact />
                <h3 className="text-sm font-medium text-zinc-100 mt-2">{read.title}</h3>
                <p className="text-[10px] text-zinc-500 mt-1 tabular-nums">
                  {formatConvictionLine(read.probability, read.side)} · Resolved
                </p>
                {read.receiptId ? (
                  <Link
                    href={receiptDetailPath(read.receiptId)}
                    className="inline-block mt-2 text-[11px] text-violet-400 hover:text-violet-300 font-medium"
                  >
                    View receipt →
                  </Link>
                ) : (
                  <p className="mt-2 text-[10px] text-zinc-600">Receipt pending generation</p>
                )}
              </article>
            ))
          )}
        </div>
      )}

      <PlacePositionModal
        read={positionRead}
        open={Boolean(positionRead)}
        onClose={() => setPositionRead(null)}
      />
      <EditAiDraftModal
        item={editAiItem}
        open={Boolean(editAiItem)}
        onClose={() => setEditAiItem(null)}
        onSave={(edits) => {
          if (editAiItem) approveAiDraft(editAiItem.id, author, edits);
        }}
      />
      <DraftEditorModal
        profile={profile}
        draft={editDraft === undefined ? null : editDraft}
        open={editDraft !== undefined}
        onClose={() => setEditDraft(undefined)}
      />
      <PostAsAgentModal
        open={postOpen}
        onClose={() => setPostOpen(false)}
        profile={profile}
      />
    </div>
  );
}

function EmptyState({
  title,
  message,
  ctaLabel,
  onCta,
}: {
  title: string;
  message: string;
  ctaLabel: string;
  onCta: () => void;
}) {
  return (
    <div className="py-10 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-950/50">
      <p className="text-sm text-zinc-200 font-medium">{title}</p>
      <p className="text-[11px] text-zinc-500 mt-1 mb-3 max-w-lg mx-auto">{message}</p>
      <button type="button" onClick={onCta} className="text-[11px] text-violet-400 hover:text-violet-300">
        {ctaLabel} →
      </button>
    </div>
  );
}
