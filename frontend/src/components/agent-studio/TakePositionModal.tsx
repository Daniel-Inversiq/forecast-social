"use client";

import { useEffect, useMemo, useState } from "react";
import type { EnrichedAgentProfile } from "@/components/agents/profile/types";
import { ConvictionField, ReadModalShell } from "@/components/public-reads/ReadModalShell";
import type { AgentReadPosition, PublicRead, PublicReadSide } from "@/components/public-reads/types";
import { usePublicReads } from "@/components/public-reads/PublicReadsProvider";
import { BetaDisclosure } from "@/components/trust/BetaDisclosure";
import { authorDefaultsFromProfile } from "./agentStudioAuthor";

import { BETA_NETWORK_SCALE } from "@/lib/betaNetworkScale";

const QUICK_SIZE_USD = [...BETA_NETWORK_SCALE.betaPositionSizesUsd] as const;

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function TakePositionModal({
  open,
  onClose,
  profile,
  onPositioned,
}: {
  open: boolean;
  onClose: () => void;
  profile: EnrichedAgentProfile;
  onPositioned?: (read: PublicRead) => void;
}) {
  const { publishAsAgent } = usePublicReads();
  const [marketOrEvent, setMarketOrEvent] = useState("");
  const [marketId, setMarketId] = useState("");
  const [side, setSide] = useState<PublicReadSide>("YES");
  const [conviction, setConviction] = useState("72");
  const [positionSizeUsd, setPositionSizeUsd] = useState("100");
  const [positionSize, setPositionSize] = useState("100");
  const [currency, setCurrency] = useState("USD");
  const [thesis, setThesis] = useState("");
  const [resolutionDate, setResolutionDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const author = useMemo(() => authorDefaultsFromProfile(profile), [profile]);

  useEffect(() => {
    if (!open) return;
    setMarketOrEvent("");
    setMarketId("");
    setSide("YES");
    setConviction("72");
    setPositionSizeUsd("100");
    setPositionSize("100");
    setCurrency("USD");
    setThesis("");
    setResolutionDate("");
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const convictionPercent = Number(conviction);
    const parsedSizeUsd = Number(positionSizeUsd);
    const parsedSize = Number(positionSize);
    if (
      !marketOrEvent.trim() ||
      convictionPercent < 1 ||
      convictionPercent > 99 ||
      parsedSizeUsd <= 0 ||
      parsedSize <= 0 ||
      thesis.trim().length < 20
    ) {
      return;
    }
    setSubmitting(true);
    const normalizedCurrency = currency.trim().toUpperCase() || "USD";
    const position: AgentReadPosition = {
      side,
      convictionPercent,
      marketLabel: marketOrEvent.trim(),
      market_id: marketId.trim() || undefined,
      position_size_usd: parsedSizeUsd,
      position_size: parsedSize,
      currency: normalizedCurrency,
      sizeLabel: `${formatUsd(parsedSizeUsd)} (${parsedSize} ${normalizedCurrency})`,
      mode: "paper",
    };

    const read = publishAsAgent({
      title: `${marketOrEvent.trim()} · ${side} position`,
      category: "Markets",
      side,
      probability: convictionPercent,
      thesis: thesis.trim(),
      resolvesAt: resolutionDate ? new Date(resolutionDate).toISOString() : undefined,
      tags: ["position", "paper", "studio"],
      marketOrNarrative: marketOrEvent.trim(),
      position,
      reasoningSource: "creator_written",
      author,
    });

    setSubmitting(false);
    onPositioned?.(read);
    onClose();
  }

  return (
    <ReadModalShell
      open={open}
      onClose={onClose}
      title="Take Position"
      subtitle="Creates a public position, linked public thesis, and a future receipt on resolution. Beta uses simulated capital."
    >
      <form onSubmit={handleSubmit} className="space-y-3">
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
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Market ID</span>
          <input
            value={marketId}
            onChange={(e) => setMarketId(e.target.value)}
            placeholder="Optional canonical market_id"
            className="mt-1 w-full h-10 rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 text-sm text-zinc-100"
          />
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

        <ConvictionField value={conviction} onChange={setConviction} side={side} required />

        <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3 space-y-3">
          <p className="text-[10px] uppercase tracking-wider text-cyan-200/90 font-semibold">
            Capital at risk
          </p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_SIZE_USD.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => {
                  setPositionSizeUsd(String(amount));
                  if (currency.trim().toUpperCase() === "USD") setPositionSize(String(amount));
                }}
                className="px-2.5 py-1 rounded-md border border-cyan-500/30 text-[11px] text-cyan-200 hover:bg-cyan-500/10"
              >
                {formatUsd(amount)}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">position_size_usd</span>
            <input
              type="number"
              min={1}
              max={BETA_NETWORK_SCALE.maxBetaPositionUsd}
              value={positionSizeUsd}
              onChange={(e) => setPositionSizeUsd(e.target.value)}
              required
              className="mt-1 w-full h-10 rounded-lg border border-cyan-500/30 bg-zinc-900/90 px-3 text-sm text-zinc-100 tabular-nums"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">position_size</span>
              <input
                type="number"
                min={1}
                value={positionSize}
                onChange={(e) => setPositionSize(e.target.value)}
                required
                className="mt-1 w-full h-10 rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 text-sm text-zinc-100 tabular-nums"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">currency</span>
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                required
                className="mt-1 w-full h-10 rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 text-sm text-zinc-100 uppercase"
              />
            </label>
          </div>
          <p className="text-[10px] text-cyan-200/70">
            Beta mode: paper positions only. No money movement or settlement yet.
          </p>
        </div>

        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Thesis</span>
          <textarea
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
            required
            minLength={20}
            rows={4}
            placeholder="What edge or information justifies this position?"
            className="mt-1 w-full rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 resize-none focus:outline-none focus:border-violet-500/50"
          />
        </label>

        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Resolution date</span>
          <input
            type="date"
            value={resolutionDate}
            onChange={(e) => setResolutionDate(e.target.value)}
            className="mt-1 w-full h-10 rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 text-sm text-zinc-100"
          />
        </label>

        <BetaDisclosure includePositionSimulation tone="muted" />

        <button
          type="submit"
          disabled={submitting}
          className="scry-tap-target sticky bottom-0 w-full min-h-[44px] rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white text-sm font-semibold transition disabled:opacity-50"
        >
          Take Position
        </button>
      </form>
    </ReadModalShell>
  );
}
