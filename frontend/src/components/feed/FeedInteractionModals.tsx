"use client";

import { useEffect, useState } from "react";
import type { FeedEvent } from "./feedMix";
import type { FeedInteractionPayload, FeedInteractionRecord } from "@/lib/feedInteractions";
import {
  FeedInteractionAuthError,
  patchFeedInteraction,
  postFeedInteraction,
} from "@/lib/feedInteractions";

type ModalKind = "back" | "challenge";

function ProbabilityInput({
  value,
  onChange,
  required,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  label: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={99}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={required ? "Required — 1 to 99" : "e.g. 68"}
          className={`scry-tap-target w-full min-h-[44px] rounded-lg border bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 tabular-nums focus:outline-none ${
            required
              ? "border-rose-500/40 focus:border-rose-500/60"
              : "border-zinc-700/80 focus:border-violet-500/50"
          }`}
        />
        <span className="text-sm text-zinc-500 shrink-0">%</span>
      </div>
    </label>
  );
}

export function FeedInteractionModal({
  kind,
  open,
  onClose,
  event,
  existing,
  onSuccess,
}: {
  kind: ModalKind;
  open: boolean;
  onClose: () => void;
  event: FeedEvent;
  existing?: FeedInteractionRecord | null;
  onSuccess: (record: FeedInteractionRecord) => void;
}) {
  const [odds, setOdds] = useState("");
  const [note, setNote] = useState("");
  const [side, setSide] = useState<"yes" | "no" | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasMarket = Boolean(event.market_slug);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setOdds(
      existing?.user_probability != null ? String(Math.round(existing.user_probability)) : "",
    );
    setNote(existing?.thesis_text ?? "");
    setSide((existing?.side as "yes" | "no") ?? "");
  }, [open, existing]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isChallenge = kind === "challenge";
  const title = isChallenge ? "Challenge this thesis" : "You're backing this thesis";
  const subtitle = isChallenge
    ? "Disagree on record. Post a counter-thesis with your read."
    : "Support thesis. Add your read — optional odds and short note.";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const eventId = event.id;
    if (eventId == null) {
      setError("Event unavailable");
      return;
    }

    const prob = odds.trim() ? Number(odds) : undefined;
    if (isChallenge && (prob == null || prob < 1 || prob > 99)) {
      setError("Odds required (1–99)");
      return;
    }
    if (isChallenge && note.trim().length < 12) {
      setError("Counter-thesis must be at least 12 characters");
      return;
    }
    if (prob != null && (prob < 1 || prob > 99)) {
      setError("Odds must be 1–99");
      return;
    }

    const payload: FeedInteractionPayload = {
      interaction_type: kind,
      thesis_text: note.trim() || undefined,
      user_probability: prob,
      side: side || undefined,
    };

    setSubmitting(true);
    try {
      const record = existing?.id
        ? await patchFeedInteraction(existing.id, payload)
        : await postFeedInteraction(eventId, payload);
      onSuccess(record);
      onClose();
    } catch (err) {
      if (err instanceof FeedInteractionAuthError) {
        setError("Sign in to put your read on record.");
      } else {
        setError(err instanceof Error ? err.message : "Could not save");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-labelledby="feed-interaction-title"
    >
      <button
        type="button"
        className="absolute inset-0 scry-backdrop-dismiss"
        aria-label="Close"
        onClick={onClose}
      />
      <form
        onSubmit={handleSubmit}
        className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border border-zinc-700/80 bg-zinc-950 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`h-0.5 w-full ${isChallenge ? "bg-gradient-to-r from-rose-500/80 to-zinc-700" : "bg-gradient-to-r from-emerald-500/70 to-violet-500/50"}`}
        />
        <div className="p-5">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
            {isChallenge ? "Challenge" : "Back this"}
          </p>
          <h2 id="feed-interaction-title" className="text-lg font-semibold text-white pr-6">
            {title}
          </h2>
          <p className="text-[11px] text-zinc-500 mt-1 leading-snug">{subtitle}</p>

          <p
            className={`mt-3 text-[10px] rounded-md px-2.5 py-1.5 border ${
              isChallenge
                ? "text-rose-200/85 border-rose-500/25 bg-rose-500/8"
                : "text-violet-200/80 border-violet-500/20 bg-violet-500/8"
            }`}
          >
            You are going on record. This is a public read — not a comment.
          </p>

          <p className="text-[10px] text-zinc-600 mt-2 line-clamp-2 border-l-2 border-zinc-700/80 pl-2">
            {event.title}
          </p>

          <div className="mt-4 space-y-3">
            <ProbabilityInput
              label={isChallenge ? "Your odds *" : "Your odds (optional)"}
              value={odds}
              onChange={setOdds}
              required={isChallenge}
            />

            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                {isChallenge ? "Counter-thesis (required)" : "Short note (optional)"}
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required={isChallenge}
                maxLength={500}
                rows={3}
                placeholder={
                  isChallenge
                    ? "Why this thesis is wrong — on the record."
                    : "Optional support note"
                }
                className="mt-1 w-full rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 resize-none focus:border-violet-500/50 focus:outline-none"
              />
            </label>

            {hasMarket && (
              <div>
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                  Market side (optional)
                </span>
                <div className="mt-1.5 flex gap-2">
                  {(["yes", "no"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSide(side === s ? "" : s)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium uppercase tracking-wide transition ${
                        side === s
                          ? s === "yes"
                            ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                            : "border-rose-500/50 bg-rose-500/15 text-rose-200"
                          : "border-zinc-700/80 text-zinc-500 hover:border-zinc-600"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="mt-3 text-[11px] text-rose-300/90" role="alert">
              {error}
            </p>
          )}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="scry-tap-target flex-1 min-h-[44px] rounded-lg border border-zinc-700/80 px-3 py-2.5 text-sm text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`scry-tap-target flex-1 min-h-[44px] rounded-lg px-3 py-2.5 text-sm font-medium text-white transition disabled:opacity-50 ${
                isChallenge
                  ? "bg-rose-600/90 hover:bg-rose-600 border border-rose-500/40"
                  : "bg-emerald-700/90 hover:bg-emerald-600 border border-emerald-500/30"
              }`}
            >
              {submitting ? "Recording…" : isChallenge ? "Post counter-thesis" : "Back on record"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
