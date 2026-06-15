"use client";

import { useEffect, useState } from "react";
import type {
  CreatePublicReadPayload,
  PublicRead,
  PublicReadAuthorDefaults,
  PublicReadCategory,
  PublicReadSide,
} from "./types";
import { usePublicReads } from "./PublicReadsProvider";
import { BeliefPicker } from "@/components/beliefs/BeliefPicker";
import { ConvictionField, ProbabilityField, ReadModalShell, READ_CATEGORIES } from "./ReadModalShell";
import { BetaDisclosure } from "@/components/trust/BetaDisclosure";

const CATEGORIES: PublicReadCategory[] = [...READ_CATEGORIES];

export function CreatePublicReadModal({
  open,
  onClose,
  onCreated,
  defaultAuthor,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (read: PublicRead) => void;
  defaultAuthor?: PublicReadAuthorDefaults;
}) {
  const { addRead } = usePublicReads();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<PublicReadCategory>("Macro");
  const [side, setSide] = useState<PublicReadSide>("YES");
  const [probability, setProbability] = useState("55");
  const [thesis, setThesis] = useState("");
  const [resolvesAt, setResolvesAt] = useState("");
  const [tags, setTags] = useState("");
  const [market, setMarket] = useState("");
  const [belief, setBelief] = useState<{ slug: string; title: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setThesis("");
    setTags("");
    setMarket("");
    setBelief(null);
    setProbability("55");
    setSide("YES");
    setCategory("Macro");
    setResolvesAt("");
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const prob = Number(probability);
    if (!title.trim() || prob < 1 || prob > 99 || thesis.trim().length < 20) return;
    setSubmitting(true);
    const payload: CreatePublicReadPayload = {
      title: title.trim(),
      category,
      side,
      probability: prob,
      thesis: thesis.trim(),
      resolvesAt: resolvesAt ? new Date(resolvesAt).toISOString() : undefined,
      tags: tags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      marketOrNarrative: market.trim() || undefined,
      author: defaultAuthor,
      beliefSlug: belief?.slug,
      beliefTitle: belief?.title,
    };
    const read = addRead(payload);
    setSubmitting(false);
    onCreated?.(read);
    onClose();
  }

  return (
    <ReadModalShell
      open={open}
      onClose={onClose}
      title={defaultAuthor ? "New read for your agent" : "Make a Public Read"}
      subtitle={
        defaultAuthor
          ? `Posting as ${defaultAuthor.authorName} — on record before resolution.`
          : "Forecasts on record before they become receipts."
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Forecast title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="mt-1 scry-tap-target w-full min-h-[44px] rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-violet-500/50"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PublicReadCategory)}
              className="mt-1 w-full h-10 rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-2 text-sm text-zinc-100"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Side</span>
            <div className="mt-1 flex gap-1">
              {(["YES", "NO"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  className={`flex-1 min-h-[40px] rounded-lg border text-xs font-semibold ${
                    side === s
                      ? s === "YES"
                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                        : "border-rose-500/50 bg-rose-500/15 text-rose-200"
                      : "border-zinc-700/80 text-zinc-500"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </label>
        </div>
        <ConvictionField value={probability} onChange={setProbability} side={side} required />
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Thesis / reasoning</span>
          <p className="text-[9px] text-zinc-600 mt-0.5">One sentence, 15–20 words — concrete why, easy to scan.</p>
          <textarea
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
            required
            minLength={20}
            rows={3}
            placeholder="e.g. ETF flows and liquidity expansion continue to overpower bearish positioning."
            className="mt-1 w-full rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-violet-500/50 resize-none"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Resolution date</span>
          <input
            type="date"
            value={resolvesAt}
            onChange={(e) => setResolvesAt(e.target.value)}
            className="mt-1 w-full h-10 rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 text-sm text-zinc-100"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Tags (comma-separated)</span>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="fed, macro, rates"
            className="mt-1 w-full h-10 rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 text-sm text-zinc-100"
          />
        </label>
        <BeliefPicker value={belief} onChange={setBelief} />
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            Linked market / narrative (optional)
          </span>
          <input
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            className="mt-1 w-full h-10 rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 text-sm text-zinc-100"
          />
        </label>
        <p className="text-[10px] text-amber-400/90 border border-amber-500/20 rounded-lg px-2.5 py-2 bg-amber-500/5">
          You are going on record. This can affect your credibility when resolved.
        </p>
        <BetaDisclosure tone="muted" />
        <button
          type="submit"
          disabled={submitting}
          className="scry-tap-target w-full min-h-[44px] rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition disabled:opacity-50"
        >
          Post Public Read
        </button>
      </form>
    </ReadModalShell>
  );
}

export function BackPublicReadModal({
  read,
  open,
  onClose,
}: {
  read: PublicRead | null;
  open: boolean;
  onClose: () => void;
}) {
  const { backRead } = usePublicReads();
  const [probability, setProbability] = useState("");
  const [thesis, setThesis] = useState("");

  useEffect(() => {
    if (!open || !read) return;
    setProbability(String(read.probability));
    setThesis("");
  }, [open, read]);

  if (!read) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!read) return;
    const prob = Number(probability);
    if (prob < 1 || prob > 99) return;
    backRead({ readId: read.id, probability: prob, thesis: thesis.trim() || undefined });
    onClose();
  }

  return (
    <ReadModalShell
      open={open}
      onClose={onClose}
      title="Back this read"
      subtitle="You are backing this forecast on record."
    >
      <div className="mb-3 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-2 text-[11px] text-zinc-400 space-y-1">
        <p>
          <span className="text-zinc-600">Author · </span>
          <span className="text-zinc-200">{read.authorName}</span>
        </p>
        <p className="tabular-nums">
          Original · {read.probability}% {read.side} · Consensus now {read.currentConsensus}%
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <ConvictionField value={probability} onChange={setProbability} side={read.side} label="Your conviction" required />
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Optional thesis</span>
          <textarea
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 resize-none focus:outline-none focus:border-emerald-500/40"
          />
        </label>
        <button
          type="submit"
          className="scry-tap-target w-full min-h-[44px] rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-sm font-semibold"
        >
          Back This Read
        </button>
      </form>
    </ReadModalShell>
  );
}

export function ChallengePublicReadModal({
  read,
  open,
  onClose,
}: {
  read: PublicRead | null;
  open: boolean;
  onClose: () => void;
}) {
  const { challengeRead } = usePublicReads();
  const [probability, setProbability] = useState("");
  const [counterThesis, setCounterThesis] = useState("");
  const [side, setSide] = useState<PublicReadSide>("NO");

  useEffect(() => {
    if (!open || !read) return;
    setProbability(String(100 - read.probability));
    setCounterThesis("");
    setSide(read.side === "YES" ? "NO" : "YES");
  }, [open, read]);

  if (!read) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!read) return;
    const prob = Number(probability);
    if (prob < 1 || prob > 99 || counterThesis.trim().length < 12) return;
    challengeRead({
      readId: read.id,
      probability: prob,
      counterThesis: counterThesis.trim(),
      side,
    });
    onClose();
  }

  return (
    <ReadModalShell
      open={open}
      onClose={onClose}
      title="Challenge this read"
      subtitle="You are going on record. This is a public read — not a comment."
    >
      <div className="mb-3 rounded-lg border border-rose-500/20 bg-rose-950/20 px-3 py-2 text-[11px] text-zinc-400">
        <p className="line-clamp-2 text-zinc-300">{read.title}</p>
        <p className="mt-1 tabular-nums text-zinc-500">
          {read.authorName} · {read.probability}% {read.side}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Your side</span>
          <div className="mt-1 flex gap-1">
            {(["YES", "NO"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSide(s)}
                className={`flex-1 min-h-[40px] rounded-lg border text-xs font-semibold ${
                  side === s
                    ? s === "YES"
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                      : "border-rose-500/50 bg-rose-500/15 text-rose-200"
                    : "border-zinc-700/80 text-zinc-500"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </label>
        <ConvictionField value={probability} onChange={setProbability} side={side} label="Your conviction" required />
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Counter-thesis (required)</span>
          <textarea
            value={counterThesis}
            onChange={(e) => setCounterThesis(e.target.value)}
            required
            minLength={12}
            rows={4}
            className="mt-1 w-full rounded-lg border border-rose-500/30 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 resize-none focus:outline-none focus:border-rose-500/50"
          />
        </label>
        <button
          type="submit"
          className="scry-tap-target w-full min-h-[44px] rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white text-sm font-semibold"
        >
          Post Counter-Read
        </button>
      </form>
    </ReadModalShell>
  );
}
