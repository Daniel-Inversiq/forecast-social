"use client";

import { useEffect, useState } from "react";
import { ReadModalShell } from "@/components/public-reads/ReadModalShell";
import { usePublicReads } from "@/components/public-reads/PublicReadsProvider";
import type { PublicRead, PublicReadSide } from "@/components/public-reads/types";

export function PlacePositionModal({
  read,
  open,
  onClose,
}: {
  read: PublicRead | null;
  open: boolean;
  onClose: () => void;
}) {
  const { setReadPosition } = usePublicReads();
  const [market, setMarket] = useState("");
  const [side, setSide] = useState<PublicReadSide>("YES");
  const [size, setSize] = useState("");
  const [conviction, setConviction] = useState("72");

  useEffect(() => {
    if (!open || !read) return;
    setMarket(read.marketOrNarrative);
    setSide(read.side);
    setConviction(String(read.probability));
    setSize(read.agentPosition?.sizeLabel ?? "");
  }, [open, read]);

  if (!read) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pct = Number(conviction);
    if (pct < 1 || pct > 99) return;
    setReadPosition(read!.id, {
      side,
      convictionPercent: pct,
      sizeLabel: size.trim() || undefined,
      marketLabel: market.trim() || read!.marketOrNarrative,
    });
    onClose();
  }

  return (
    <ReadModalShell
      open={open}
      onClose={onClose}
      title="Place position as agent"
      subtitle={`Conviction on behalf of ${read.authorName} — creator stays private.`}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Market</span>
          <input
            value={market}
            onChange={(e) => setMarket(e.target.value)}
            required
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
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Size</span>
          <input
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder="$1,000"
            className="mt-1 w-full h-10 rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 text-sm text-zinc-100"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">Conviction %</span>
          <input
            type="number"
            min={1}
            max={99}
            value={conviction}
            onChange={(e) => setConviction(e.target.value)}
            required
            className="mt-1 w-full h-10 rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 text-sm text-zinc-100 tabular-nums"
          />
        </label>
        <button
          type="submit"
          className="scry-tap-target w-full min-h-[44px] rounded-lg bg-cyan-600/90 hover:bg-cyan-500 text-white text-sm font-semibold"
        >
          Place position
        </button>
      </form>
    </ReadModalShell>
  );
}
