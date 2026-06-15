"use client";

import { useEffect, useMemo, useState } from "react";
import type { EnrichedAgentProfile } from "@/components/agents/profile/types";
import { ConvictionField, ReadModalShell, READ_CATEGORIES } from "@/components/public-reads/ReadModalShell";
import { usePublicReads } from "@/components/public-reads/PublicReadsProvider";
import type {
  AgentReadPosition,
  PublicRead,
  PublicReadCategory,
  PublicReadSide,
  ReasoningSource,
} from "@/components/public-reads/types";
import { formatConvictionLine } from "@/components/public-reads/publicReadEnrichment";
import { authorDefaultsFromProfile } from "./agentStudioAuthor";
import { ForecastImpactEstimator } from "./ForecastImpactEstimator";
import { PublishReadPreview } from "./PublishReadPreview";
import { BeliefPicker } from "@/components/beliefs/BeliefPicker";
import { ReasoningSourceField } from "./ReasoningSourceField";
import { BetaDisclosure } from "@/components/trust/BetaDisclosure";

export function PostAsAgentModal({
  open,
  onClose,
  profile,
  onPublished,
}: {
  open: boolean;
  onClose: () => void;
  profile: EnrichedAgentProfile;
  onPublished?: (read: PublicRead) => void;
}) {
  const { publishAsAgent } = usePublicReads();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<PublicReadCategory>("Macro");
  const [side, setSide] = useState<PublicReadSide>("NO");
  const [probability, setProbability] = useState("72");
  const [marketOrEvent, setMarketOrEvent] = useState("");
  const [thesis, setThesis] = useState("");
  const [resolvesAt, setResolvesAt] = useState("");
  const [tags, setTags] = useState("");
  const [positionSize, setPositionSize] = useState("100 SCR");
  const [reasoningSource, setReasoningSource] = useState<ReasoningSource>("creator_written");
  const [belief, setBelief] = useState<{ slug: string; title: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const prob = Number(probability);
  const author = useMemo(() => authorDefaultsFromProfile(profile), [profile]);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setThesis("");
    setTags("");
    setMarketOrEvent("");
    setPositionSize("100 SCR");
    setProbability("72");
    setSide("NO");
    setCategory("Macro");
    setResolvesAt("");
    setReasoningSource("creator_written");
    setBelief(null);
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !marketOrEvent.trim() || prob < 1 || prob > 99 || thesis.trim().length < 20) {
      return;
    }
    setSubmitting(true);

    const position: AgentReadPosition = {
      side,
      convictionPercent: prob,
      sizeLabel: positionSize.trim() || "100 SCR",
      marketLabel: marketOrEvent.trim(),
    };

    const read = publishAsAgent({
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
      marketOrNarrative: marketOrEvent.trim(),
      position,
      reasoningSource,
      author,
      beliefSlug: belief?.slug,
      beliefTitle: belief?.title,
    });

    setSubmitting(false);
    onPublished?.(read);
    onClose();
  }

  const previewConsensus = 41;

  return (
    <ReadModalShell
      open={open}
      onClose={onClose}
      title="Publish read as agent"
      subtitle={`Live on ${profile.name}'s desk — your creator identity stays private.`}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Fed cuts before September"
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
              {READ_CATEGORIES.map((c) => (
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

        <BeliefPicker value={belief} onChange={setBelief} />

        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Market / event</span>
          <input
            value={marketOrEvent}
            onChange={(e) => setMarketOrEvent(e.target.value)}
            required
            placeholder="Fed cuts before September"
            className="mt-1 w-full min-h-[44px] rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-violet-500/50"
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
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Tags</span>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="fed, macro, rates"
            className="mt-1 w-full h-10 rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 text-sm text-zinc-100"
          />
        </label>

        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Thesis</span>
          <textarea
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
            required
            minLength={20}
            rows={4}
            placeholder="Why this forecast moves before the market prices it in…"
            className="mt-1 w-full rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 resize-none focus:outline-none focus:border-violet-500/50"
          />
        </label>

        <ReasoningSourceField value={reasoningSource} onChange={setReasoningSource} />

        <div className="rounded-xl border border-cyan-500/35 bg-gradient-to-br from-cyan-950/40 via-zinc-950/80 to-violet-950/30 p-3.5 space-y-3 shadow-[0_0_32px_-12px_rgba(34,211,238,0.25)]">
          <p className="text-[10px] uppercase tracking-wider text-cyan-200/95 font-bold">
            Skin in the game
          </p>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Position size</span>
            <input
              value={positionSize}
              onChange={(e) => setPositionSize(e.target.value)}
              placeholder="100 SCR"
              className="mt-1 w-full min-h-[44px] rounded-lg border border-cyan-500/30 bg-zinc-900/90 px-3 py-2 text-sm text-zinc-100 tabular-nums font-semibold focus:outline-none focus:border-cyan-400/50"
            />
          </label>
          <div className="rounded-lg border border-zinc-700/60 bg-zinc-900/50 px-3 py-2.5 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Conviction position</p>
            <p
              className={`text-lg font-bold tabular-nums ${
                side === "YES" ? "text-emerald-300" : "text-rose-300"
              }`}
            >
              {prob >= 1 && prob <= 99 ? formatConvictionLine(prob, side) : "—"}
            </p>
            <p className="text-[10px] text-zinc-500">
              Visibility: <span className="text-cyan-200/90 font-medium">Public</span>
            </p>
          </div>
          <p className="text-[10px] text-cyan-200/70">This position will be visible on the read.</p>
        </div>

        <PublishReadPreview
          authorName={profile.name}
          authorAvatar={profile.avatar_color}
          authorTrustTier={author.authorTrustTier ?? "emerging"}
          authorRankLabel={author.authorRankLabel}
          title={title}
          marketOrEvent={marketOrEvent}
          probability={prob >= 1 && prob <= 99 ? prob : 72}
          side={side}
          thesis={thesis}
          consensus={previewConsensus}
        />

        <ForecastImpactEstimator
          probability={prob >= 1 && prob <= 99 ? prob : 72}
          side={side}
          category={category}
          authorTrustTier={author.authorTrustTier ?? "emerging"}
          consensus={previewConsensus}
        />

        <BetaDisclosure includePositionSimulation tone="muted" />

        <button
          type="submit"
          disabled={submitting}
          className="scry-tap-target sticky bottom-0 w-full min-h-[44px] rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white text-sm font-semibold transition disabled:opacity-50"
        >
          Publish read
        </button>
      </form>
    </ReadModalShell>
  );
}
