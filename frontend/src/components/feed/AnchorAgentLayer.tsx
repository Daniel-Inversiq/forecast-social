"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { HeatPill, LiveDot } from "@/components/feed/shared";
import { useAuth } from "@/context/AuthProvider";
import {
  fetchAnchorAgent,
  type AnchorAgentPayload,
  type AnchorMood,
} from "@/lib/anchorAgent";

const MOOD_TONE: Record<AnchorMood, { border: string; pill: "violet" | "rose" | "amber" | "emerald" | "sky" | "cyan" }> = {
  loud: { border: "border-violet-500/25 bg-violet-950/20", pill: "violet" },
  quiet: { border: "border-zinc-700/60 bg-zinc-950/50", pill: "sky" },
  isolated: { border: "border-cyan-500/20 bg-cyan-950/15", pill: "cyan" },
  aggressive: { border: "border-rose-500/25 bg-rose-950/20", pill: "rose" },
  cooling: { border: "border-sky-500/20 bg-sky-950/15", pill: "sky" },
  doubling_down: { border: "border-amber-500/25 bg-amber-950/20", pill: "amber" },
  under_pressure: { border: "border-rose-500/30 bg-rose-950/25", pill: "rose" },
  vindicated: { border: "border-emerald-500/25 bg-emerald-950/20", pill: "emerald" },
  exposed: { border: "border-rose-500/35 bg-rose-950/30", pill: "rose" },
};

function AgentAvatar({ name, color, size = "md" }: { name: string; color: string; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "h-5 w-5 text-[9px]" : "h-8 w-8 text-[11px]";
  return (
    <span
      className={`inline-flex rounded-full border border-zinc-900/80 font-bold items-center justify-center text-white shrink-0 ${dim}`}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {name.slice(0, 1)}
    </span>
  );
}

function AnchorAgentChip({ payload }: { payload: AnchorAgentPayload }) {
  const agent = payload.agent!;
  const mood = payload.mood ?? "cooling";
  const tone = MOOD_TONE[mood] ?? MOOD_TONE.cooling;

  return (
    <Link
      href={payload.href}
      className={`anchor-agent-chip inline-flex items-center gap-2 rounded-full border px-2.5 py-1 feed-fade-in transition hover:border-violet-500/35 ${tone.border}`}
    >
      <AgentAvatar name={agent.name} color={agent.avatar_color} size="sm" />
      <span className="text-[10px] text-zinc-300 truncate max-w-[140px] sm:max-w-[200px]">
        <span className="text-violet-400/70 font-medium">Anchor · </span>
        {agent.name}
        {payload.mood_label && (
          <span className="text-zinc-500 ml-1">· {payload.mood_label}</span>
        )}
      </span>
      <LiveDot color="violet" />
    </Link>
  );
}

export function AnchorAgentLayer({
  initialPayload,
  prominent = false,
}: {
  initialPayload?: AnchorAgentPayload | null;
  prominent?: boolean;
}) {
  const { loading: authLoading } = useAuth();
  const [payload, setPayload] = useState<AnchorAgentPayload | null>(initialPayload ?? null);
  const [loading, setLoading] = useState(!initialPayload);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAnchorAgent();
      setPayload(data);
    } catch {
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialPayload) {
      setPayload(initialPayload);
      setLoading(false);
      return;
    }
    if (authLoading) return;
    void load();
  }, [authLoading, initialPayload, load]);

  if (loading && !payload) return null;
  if (!payload) return null;
  if (!payload.has_anchor) return null;

  if (!payload.pinned) {
    return (
      <div className="flex flex-wrap items-center gap-2 feed-fade-in">
        <AnchorAgentChip payload={payload} />
        <Link href="/agents" className="text-[9px] text-zinc-500 hover:text-violet-300/90 transition">
          Pin anchor →
        </Link>
      </div>
    );
  }

  const agent = payload.agent!;
  const mood = payload.mood ?? "cooling";
  const tone = MOOD_TONE[mood] ?? MOOD_TONE.cooling;
  const extraLines = payload.lines.slice(1, 2);

  const statusLabel = payload.mood_label ?? "Consensus Forming";
  const reasonLine = payload.headline || extraLines[0] || payload.lines[0];

  return (
    <section
      className={`rounded-lg border feed-fade-in feed-hover-lift transition ${tone.border} ${
        prominent ? "px-3.5 py-3 sm:px-4 sm:py-3.5 shadow-md shadow-violet-950/15" : "px-3 py-2"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href={payload.href} className="shrink-0">
            <AgentAvatar name={agent.name} color={agent.avatar_color} size={prominent ? "md" : "md"} />
          </Link>
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-[0.14em] text-violet-400/75">Your anchor</p>
            <Link href={payload.href} className="block min-w-0">
              <h3
                className={`font-semibold text-zinc-100 truncate hover:text-white transition ${
                  prominent ? "text-[13px] sm:text-sm" : "text-[11px]"
                }`}
              >
                {agent.name}
              </h3>
            </Link>
          </div>
        </div>
        <LiveDot color="violet" />
      </div>

      <div className="space-y-1 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Status</span>
          <HeatPill tone={tone.pill}>{statusLabel}</HeatPill>
        </div>
        {reasonLine && (
          <div>
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider block mb-0.5">Reason</span>
            <Link href={payload.href} className="block">
              <p className="text-[10px] sm:text-[11px] text-violet-100/90 leading-snug line-clamp-2">
                {reasonLine}
              </p>
            </Link>
          </div>
        )}
        {extraLines.map((line) => (
          <p key={line} className="text-[10px] text-zinc-500 leading-snug line-clamp-1">
            {line}
          </p>
        ))}
      </div>

      <div className="flex items-center justify-end pt-1.5 border-t border-zinc-800/50">
        <Link
          href={payload.href}
          className="text-[9px] text-violet-300/90 hover:text-violet-200 transition"
        >
          Open Desk →
        </Link>
      </div>
    </section>
  );
}
