"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CABINET_METAL, milestoneStyle, milestoneSymbol } from "./milestoneStyles";
import { useAuth } from "@/context/AuthProvider";
import { patchAgentFeaturedMilestones, patchUserFeaturedMilestones } from "@/lib/featuredMarks";
import { dispatchFeaturedMarksUpdated } from "@/lib/useUserFeaturedMarks";
import { API_BASE } from "@/lib/api";
import type { MilestoneRecord, ReputationMark } from "@/lib/reputation";
import type { AgentReputationPayload } from "@/components/agents/profile/types";

const MAX = 3;

function prestigeTier(prestige: number | undefined): { label: string; className: string } {
  const p = prestige ?? 50;
  if (p >= 85) return { label: "Exceptional", className: "text-amber-200/90 border-amber-500/30" };
  if (p >= 75) return { label: "Elite", className: "text-violet-200/90 border-violet-500/25" };
  if (p >= 65) return { label: "Rare", className: "text-sky-200/80 border-sky-500/20" };
  return { label: "Recorded", className: "text-zinc-500 border-zinc-700/50" };
}

function EquippedPlaque({
  milestone,
  index,
  saving,
  onMoveUp,
  onMoveDown,
  onRemove,
  canMoveUp,
  canMoveDown,
}: {
  milestone: MilestoneRecord;
  index: number;
  saving: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const s = milestoneStyle(milestone.category);
  const sym = milestone.symbol ?? milestoneSymbol(milestone.key, milestone.category);
  const tier = prestigeTier(milestone.prestige);

  return (
    <div
      className={`relative rounded-xl border px-4 py-4 ${CABINET_METAL} ${s.border} ${s.glow} feed-hover-lift`}
    >
      <span className="absolute top-2.5 right-2.5 text-[8px] font-mono text-zinc-600 tabular-nums">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="flex items-start gap-3">
        <span className={`text-2xl leading-none mt-0.5 ${s.text} opacity-90`}>{sym}</span>
        <div className="min-w-0 flex-1">
          <p className={`text-[12px] font-semibold tracking-wide ${s.text}`}>{milestone.title}</p>
          <p className="text-[9px] text-zinc-500 mt-1 uppercase tracking-[0.14em]">{milestone.category}</p>
          <span
            className={`inline-block mt-2 text-[7px] uppercase tracking-[0.2em] px-1.5 py-0.5 rounded border ${tier.className}`}
          >
            {tier.label}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-zinc-800/60">
        <button
          type="button"
          disabled={!canMoveUp || saving}
          onClick={onMoveUp}
          className="flex-1 text-[10px] py-1 rounded border border-zinc-800/80 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 disabled:opacity-25 transition"
          aria-label="Move up"
        >
          ↑
        </button>
        <button
          type="button"
          disabled={!canMoveDown || saving}
          onClick={onMoveDown}
          className="flex-1 text-[10px] py-1 rounded border border-zinc-800/80 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 disabled:opacity-25 transition"
          aria-label="Move down"
        >
          ↓
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onRemove}
          className="flex-1 text-[10px] py-1 rounded border border-zinc-800/80 text-zinc-600 hover:text-rose-400/90 hover:border-rose-500/25 disabled:opacity-25 transition"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function EmptySlot({ index }: { index: number }) {
  return (
    <div
      className={`rounded-xl border border-dashed border-zinc-800/90 bg-zinc-950/40 px-4 py-6 flex flex-col items-center justify-center min-h-[140px] ${CABINET_METAL}`}
    >
      <span className="text-[10px] font-mono text-zinc-700 tabular-nums mb-2">
        {String(index + 1).padStart(2, "0")}
      </span>
      <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-600">Vacant</p>
      <p className="text-[10px] text-zinc-700 mt-1 text-center max-w-[120px]">
        Equip from unlocked archive below
      </p>
    </div>
  );
}

function MilestoneGridCard({
  milestone,
  state,
  saving,
  onClick,
}: {
  milestone: MilestoneRecord;
  state: "equipped" | "unlocked" | "locked";
  saving: boolean;
  onClick?: () => void;
}) {
  const s = milestoneStyle(milestone.category);
  const sym = milestone.symbol ?? milestoneSymbol(milestone.key, milestone.category);
  const tier = prestigeTier(milestone.prestige);
  const locked = state === "locked";
  const equipped = state === "equipped";

  const body = (
    <>
      <div className="flex items-start gap-2.5">
        <span
          className={`text-xl leading-none ${locked ? "text-zinc-700 opacity-40" : `${s.text} opacity-90`}`}
        >
          {sym}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-semibold tracking-wide ${locked ? "text-zinc-600" : s.text}`}>
            {milestone.title}
          </p>
          <p className="text-[9px] text-zinc-600 mt-0.5 uppercase tracking-wider">{milestone.category}</p>
        </div>
        {locked && (
          <span className="text-[7px] uppercase tracking-[0.22em] text-zinc-700 border border-zinc-800 px-1 py-0.5 rounded">
            Locked
          </span>
        )}
        {equipped && (
          <span className="text-[7px] uppercase tracking-[0.22em] text-amber-500/70 border border-amber-500/20 px-1 py-0.5 rounded">
            Equipped
          </span>
        )}
      </div>
      <p className={`text-[10px] mt-2 leading-relaxed line-clamp-2 ${locked ? "text-zinc-700" : "text-zinc-500"}`}>
        {milestone.description}
      </p>
      {!locked && (
        <span className={`inline-block mt-2 text-[7px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded border ${tier.className}`}>
          {tier.label}
        </span>
      )}
      {locked && (
        <p className="text-[9px] text-zinc-700 mt-2 italic">Requirement on record · not yet earned</p>
      )}
    </>
  );

  if (locked || !onClick) {
    return (
      <div
        className={`rounded-lg border px-3 py-3 ${CABINET_METAL} border-zinc-800/70 opacity-45 select-none`}
      >
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={saving || equipped}
      onClick={onClick}
      className={`w-full text-left rounded-lg border px-3 py-3 transition ${CABINET_METAL} ${
        equipped
          ? `${s.border} ring-1 ring-amber-500/15 opacity-70 cursor-default`
          : `${s.border} hover:border-zinc-600/80 hover:bg-zinc-900/50`
      } ${saving ? "opacity-50 pointer-events-none" : ""}`}
    >
      {body}
    </button>
  );
}

export function FeaturedReputationMarksManager({
  slug,
  reputation,
  onUpdated,
  endpoint = "user",
}: {
  slug: string;
  reputation: AgentReputationPayload | undefined;
  onUpdated?: (keys: string[], marks: ReputationMark[]) => void;
  endpoint?: "agent" | "user";
}) {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<MilestoneRecord[]>(reputation?.milestone_catalog ?? []);
  const [equipped, setEquipped] = useState<string[]>(reputation?.featured_milestone_keys ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlocked = reputation?.milestones ?? [];

  useEffect(() => {
    setEquipped(reputation?.featured_milestone_keys ?? []);
  }, [reputation?.featured_milestone_keys]);

  useEffect(() => {
    if (reputation?.milestone_catalog?.length) {
      setCatalog(reputation.milestone_catalog);
      return;
    }
    let cancelled = false;
    async function loadCatalog() {
      try {
        const res = await fetch(`${API_BASE}/reputation/milestones/catalog`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.milestones)) {
          setCatalog(data.milestones);
        }
      } catch {
        /* keep empty */
      }
    }
    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [reputation?.milestone_catalog]);

  const unlockedByKey = useMemo(() => {
    const m = new Map<string, MilestoneRecord>();
    for (const item of unlocked) m.set(item.key, item);
    return m;
  }, [unlocked]);

  const catalogSorted = useMemo(
    () => [...catalog].sort((a, b) => (b.prestige ?? 50) - (a.prestige ?? 50)),
    [catalog],
  );

  const locked = useMemo(
    () => catalogSorted.filter((m) => !unlockedByKey.has(m.key)),
    [catalogSorted, unlockedByKey],
  );

  const unlockedSorted = useMemo(
    () =>
      [...unlocked].sort((a, b) => (b.prestige ?? 50) - (a.prestige ?? 50)),
    [unlocked],
  );

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
        dispatchFeaturedMarksUpdated();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update featured marks");
        setEquipped(reputation?.featured_milestone_keys ?? []);
      } finally {
        setSaving(false);
      }
    },
    [slug, endpoint, onUpdated, reputation?.featured_milestone_keys],
  );

  const equip = (key: string) => {
    if (equipped.includes(key)) return;
    if (equipped.length >= MAX) {
      setError("Maximum three marks — remove one to equip another");
      return;
    }
    setError(null);
    const next = [...equipped, key];
    setEquipped(next);
    void save(next);
  };

  const remove = (key: string) => {
    const next = equipped.filter((k) => k !== key);
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

  const equippedMilestones = equipped
    .map((k) => unlockedByKey.get(k))
    .filter(Boolean) as MilestoneRecord[];

  if (!user) {
    return (
      <section className={`rounded-2xl border border-zinc-800/80 overflow-hidden ${CABINET_METAL}`}>
        <div className="px-5 py-4 border-b border-zinc-800/60">
          <h2 className="text-sm font-semibold text-zinc-300 tracking-tight">Featured Reputation Marks</h2>
        </div>
        <div className="p-5">
          <p className="text-[11px] text-zinc-500">Sign in to equip prestige marks on your public identity.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`rounded-2xl border border-amber-500/10 overflow-hidden relative ${CABINET_METAL}`}
      id="featured-reputation-marks"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-amber-950/10 via-transparent to-violet-950/10 pointer-events-none" />
      <div className="relative px-4 sm:px-5 py-4 border-b border-zinc-800/60">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-zinc-100 tracking-tight">
              Featured Reputation Marks
            </h2>
            <p className="text-[11px] text-zinc-500 mt-1 max-w-lg leading-relaxed">
              Public prestige layer on your forecasting identity — feed, profile, and leaderboards.
              Equip up to three archival marks in display order.
            </p>
          </div>
          <div className="text-right">
            {saving ? (
              <span className="text-[10px] text-zinc-500 animate-pulse font-mono">Committing…</span>
            ) : (
              <span className="text-[10px] text-zinc-600 font-mono tabular-nums">
                {equipped.length}/{MAX} equipped
              </span>
            )}
          </div>
        </div>
        {error && (
          <p className="text-[11px] text-rose-400/90 mt-2 border border-rose-500/20 bg-rose-950/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>

      <div className="relative px-4 sm:px-5 py-5 border-b border-zinc-800/50">
        <p className="text-[9px] uppercase tracking-[0.22em] text-zinc-600 mb-3">Equipped · public order</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: MAX }, (_, i) => {
            const m = equippedMilestones[i];
            if (m) {
              return (
                <EquippedPlaque
                  key={m.key}
                  milestone={m}
                  index={i}
                  saving={saving}
                  canMoveUp={i > 0}
                  canMoveDown={i < equippedMilestones.length - 1}
                  onMoveUp={() => move(i, -1)}
                  onMoveDown={() => move(i, 1)}
                  onRemove={() => remove(m.key)}
                />
              );
            }
            return <EmptySlot key={`empty-${i}`} index={i} />;
          })}
        </div>
      </div>

      <div className="relative px-4 sm:px-5 py-5 border-b border-zinc-800/50">
        <p className="text-[9px] uppercase tracking-[0.22em] text-zinc-600 mb-1">Unlocked archive</p>
        <p className="text-[10px] text-zinc-600 mb-3">
          {unlockedSorted.length === 0
            ? "No marks on record yet — verified calls, timing edge, and consensus breaks unlock standing."
            : "Select a mark to equip · changes commit immediately"}
        </p>
        {unlockedSorted.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {unlockedSorted.map((m) => (
              <MilestoneGridCard
                key={m.key}
                milestone={m}
                state={equipped.includes(m.key) ? "equipped" : "unlocked"}
                saving={saving}
                onClick={() => equip(m.key)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-800/80 px-4 py-6 text-center">
            <p className="text-[11px] text-zinc-600">
              Linked agent identity or verified track record required to unlock marks.
            </p>
          </div>
        )}
      </div>

      {locked.length > 0 && (
        <div className="relative px-4 sm:px-5 py-5">
          <p className="text-[9px] uppercase tracking-[0.22em] text-zinc-700 mb-1">Locked · aspirational</p>
          <p className="text-[10px] text-zinc-700 mb-3">
            Prestige markers awaiting qualification on the public ledger
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {locked.map((m) => (
              <MilestoneGridCard key={m.key} milestone={m} state="locked" saving={saving} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
