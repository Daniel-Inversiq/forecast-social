"use client";

import { useCallback, useEffect, useState } from "react";
import { FeaturedReputationMarks } from "@/components/milestones/FeaturedReputationMarks";
import { milestoneStyle } from "@/components/milestones/milestoneStyles";
import { useAuth } from "@/context/AuthProvider";
import { patchAgentFeaturedMilestones, patchUserFeaturedMilestones } from "@/lib/featuredMarks";
import { dispatchFeaturedMarksUpdated } from "@/lib/useUserFeaturedMarks";
import type { MilestoneRecord, ReputationMark } from "@/lib/reputation";
import type { AgentReputationPayload } from "./types";

const MAX = 3;

export function ProfileFeaturedMarksEditor({
  slug,
  reputation,
  onUpdated,
  endpoint = "agent",
}: {
  slug: string;
  reputation: AgentReputationPayload | undefined;
  onUpdated?: (keys: string[], marks: ReputationMark[]) => void;
  /** Use user API when editing own human identity (not agent slug route). */
  endpoint?: "agent" | "user";
}) {
  const { user } = useAuth();
  const unlocked = reputation?.milestones ?? [];
  const displayMarks: ReputationMark[] =
    reputation?.featured_reputation_marks ??
    (reputation?.featured_milestone_keys ?? [])
      .map((k) => unlocked.find((m) => m.key === k))
      .filter(Boolean)
      .map((m) => ({
        key: m!.key,
        title: m!.title,
        category: m!.category,
        symbol: m!.symbol ?? milestoneStyle(m!.category).icon,
      }));
  const [equipped, setEquipped] = useState<string[]>(
    reputation?.featured_milestone_keys ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEquipped(reputation?.featured_milestone_keys ?? []);
  }, [reputation?.featured_milestone_keys]);

  const save = useCallback(
    async (keys: string[]) => {
      setSaving(true);
      setError(null);
      try {
        const res =
          endpoint === "user"
            ? await patchUserFeaturedMilestones(keys)
            : await patchAgentFeaturedMilestones(slug, keys);
        setEquipped(res.featured_milestone_keys);
        onUpdated?.(res.featured_milestone_keys, res.featured_reputation_marks);
        if (endpoint === "user") dispatchFeaturedMarksUpdated();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save marks");
        setEquipped(reputation?.featured_milestone_keys ?? []);
      } finally {
        setSaving(false);
      }
    },
    [slug, endpoint, onUpdated, reputation?.featured_milestone_keys],
  );

  const toggle = (key: string) => {
    let next: string[];
    if (equipped.includes(key)) {
      next = equipped.filter((k) => k !== key);
    } else if (equipped.length >= MAX) {
      return;
    } else {
      next = [...equipped, key];
    }
    setEquipped(next);
    void save(next);
  };

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= equipped.length) return;
    const next = [...equipped];
    [next[index], next[j]] = [next[j], next[index]];
    setEquipped(next);
    void save(next);
  };

  if (!user) {
    return (
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/90 p-4">
        <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-600">Featured reputation marks</p>
        <FeaturedReputationMarks marks={displayMarks} limit={3} className="mt-2" />
        <p className="text-[10px] text-zinc-600 mt-2">Sign in to equip prestige marks on your public identity.</p>
      </div>
    );
  }

  if (unlocked.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/90 p-4">
        <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-600">Featured reputation marks</p>
        <p className="text-[11px] text-zinc-500 mt-2">Unlock milestones to equip public prestige marks.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-gradient-to-br from-zinc-950 via-zinc-950/98 to-zinc-900/90 p-3 sm:p-4 feed-hover-lift">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div>
          <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">Featured reputation marks</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">Equip up to 3 · displayed on feed & leaderboards</p>
        </div>
        {saving && <span className="text-[9px] text-zinc-600 animate-pulse">Saving…</span>}
      </div>

      <FeaturedReputationMarks marks={displayMarks} limit={3} compact={false} className="mb-4" />

      {error && <p className="text-[10px] text-rose-400/80 mb-2">{error}</p>}

      <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-2">Equipped order</p>
      <ol className="space-y-1 mb-4">
        {equipped.length === 0 && (
          <li className="text-[10px] text-zinc-600 py-2 border border-dashed border-zinc-800 rounded-lg text-center">
            None equipped — select below
          </li>
        )}
        {equipped.map((key, i) => {
          const m = unlocked.find((u) => u.key === key);
          if (!m) return null;
          const s = milestoneStyle(m.category);
          return (
            <li
              key={key}
              className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 bg-zinc-900/50 ${s.border}`}
            >
              <span className={`text-sm ${s.text}`}>{m.symbol ?? s.icon}</span>
              <span className="text-[10px] text-zinc-300 flex-1 truncate">{m.title}</span>
              <button
                type="button"
                disabled={i === 0 || saving}
                onClick={() => move(i, -1)}
                className="text-[10px] text-zinc-600 hover:text-zinc-400 disabled:opacity-30 px-1"
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={i === equipped.length - 1 || saving}
                onClick={() => move(i, 1)}
                className="text-[10px] text-zinc-600 hover:text-zinc-400 disabled:opacity-30 px-1"
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => toggle(key)}
                className="text-[9px] text-zinc-600 hover:text-rose-400/80 px-1"
              >
                Remove
              </button>
            </li>
          );
        })}
      </ol>

      <p className="text-[8px] uppercase tracking-wider text-zinc-600 mb-2">Unlocked</p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {unlocked.map((m: MilestoneRecord) => {
          const on = equipped.includes(m.key);
          const full = !on && equipped.length >= MAX;
          const s = milestoneStyle(m.category);
          return (
            <li key={m.key}>
              <button
                type="button"
                disabled={full || saving}
                onClick={() => toggle(m.key)}
                className={`w-full text-left rounded-lg border px-2.5 py-2 transition ${
                  on
                    ? `${s.border} bg-zinc-900/70 ring-1 ring-amber-500/10`
                    : "border-zinc-800/80 bg-zinc-900/30 hover:border-zinc-700/80"
                } ${full ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                <span className={`text-[10px] font-medium ${on ? s.text : "text-zinc-400"}`}>
                  {m.symbol ?? s.icon} {m.title}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
