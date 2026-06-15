"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EnrichedAgentProfile } from "@/components/agents/profile/types";
import { deleteKnowledgeSource, uploadKnowledgePdf } from "@/lib/creatorForecaster";
import {
  fetchStudioAgentKnowledge,
  worldviewSliderMeta,
  type AgentKnowledgeProfile,
  type AgentBelief,
  type InfluenceRow,
  type KnowledgeSourceRow,
} from "@/lib/agentKnowledge";

function SectionHeader({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">{title}</h3>
        {subtitle && <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{subtitle}</p>}
      </div>
      {trailing}
    </div>
  );
}

function KnowledgePanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-xl border border-zinc-800/85 bg-gradient-to-b from-zinc-950/95 to-zinc-950/60 p-4 sm:p-5 ${className}`}
    >
      {children}
    </section>
  );
}

function SourceRow({
  source,
  onRemove,
  onReplace,
  removing,
}: {
  source: KnowledgeSourceRow;
  onRemove: () => void;
  onReplace: () => void;
  removing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="py-3 border-b border-zinc-800/60 last:border-0">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-zinc-200 truncate">{source.display_name}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-zinc-600">
            <span className="uppercase tracking-wider text-zinc-500">{source.type_label}</span>
            <span>·</span>
            <span>Uploaded {source.uploaded_ago}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <span
            className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
              source.is_active
                ? "border-emerald-500/35 text-emerald-200 bg-emerald-950/25"
                : source.status === "processing"
                  ? "border-amber-500/35 text-amber-200 bg-amber-950/20"
                  : "border-zinc-700 text-zinc-500 bg-zinc-900/40"
            }`}
          >
            {source.status_label}
          </span>
          {source.summary && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[11px] px-2.5 py-1 rounded-lg border border-zinc-700/80 text-zinc-400 hover:text-zinc-200 transition"
            >
              {expanded ? "Hide" : "View"}
            </button>
          )}
          <button
            type="button"
            onClick={onReplace}
            className="text-[11px] px-2.5 py-1 rounded-lg border border-zinc-700/80 text-zinc-400 hover:text-violet-200 hover:border-violet-500/30 transition"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={removing}
            className="text-[11px] px-2.5 py-1 rounded-lg border border-zinc-700/80 text-zinc-500 hover:text-rose-300 hover:border-rose-500/30 transition disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </div>
      {expanded && source.summary && (
        <p className="mt-2 text-[12px] text-zinc-400 leading-relaxed pl-0.5">{source.summary}</p>
      )}
    </div>
  );
}

function BeliefCard({ belief }: { belief: AgentBelief }) {
  return (
    <div className="rounded-xl border border-violet-500/12 bg-violet-950/15 p-4 flex flex-col gap-3 feed-hover-lift">
      <p className="text-[13px] text-zinc-200 leading-relaxed">{belief.belief}</p>
      <div className="flex items-end justify-between gap-3 mt-auto">
        <div>
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 mb-0.5">Source</p>
          <p className="text-[11px] text-violet-300/90 truncate">{belief.origin_source}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold tabular-nums text-violet-200 leading-none">
            {belief.confidence}
          </p>
          <p className="text-[9px] uppercase tracking-wider text-zinc-600 mt-0.5">conviction</p>
        </div>
      </div>
    </div>
  );
}

function InfluenceBars({ rows }: { rows: InfluenceRow[] }) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.source}>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-zinc-400 truncate pr-2">{row.source}</span>
            <span className="text-violet-300 tabular-nums shrink-0">{row.pct}%</span>
          </div>
          <div className="h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/50">
            <div
              className="h-full bg-gradient-to-r from-violet-700/90 via-violet-500/80 to-cyan-500/50 rounded-full transition-all duration-700"
              style={{ width: `${row.pct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function WorldviewSlidersReadonly({ sliders }: { sliders: AgentKnowledgeProfile["worldview"]["sliders"] }) {
  const meta = worldviewSliderMeta();
  return (
    <div className="space-y-4">
      {meta.map(({ key, label, low, high }) => (
        <div key={key}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] text-zinc-400">{label}</span>
            <span className="text-[11px] tabular-nums text-zinc-600">{sliders[key]}</span>
          </div>
          <div className="relative h-1.5 rounded-full bg-zinc-800/90 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-800/80 to-violet-400/70"
              style={{ width: `${sliders[key]}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-zinc-600 mt-1">
            <span>{low}</span>
            <span>{high}</span>
          </div>
        </div>
      ))}
      <p className="text-[10px] text-zinc-600 italic pt-1">Calibration is read-only in v1 — evolution coming.</p>
    </div>
  );
}

export function AgentStudioKnowledgeTab({
  profile,
  forecasterId,
}: {
  profile: EnrichedAgentProfile;
  forecasterId: number | null;
}) {
  const [knowledge, setKnowledge] = useState<AgentKnowledgeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceSourceIdRef = useRef<number | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStudioAgentKnowledge(profile.slug);
      setKnowledge(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load knowledge");
    } finally {
      setLoading(false);
    }
  }, [profile.slug]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleUpload = async (file: File, replaceId?: number) => {
    const cfId = forecasterId ?? knowledge?.creator_forecaster_id;
    if (!cfId) return;
    setUploading(true);
    try {
      if (replaceId != null) {
        await deleteKnowledgeSource(cfId, replaceId);
      }
      await uploadKnowledgePdf(cfId, file);
      await reload();
    } finally {
      setUploading(false);
      replaceSourceIdRef.current = null;
    }
  };

  const handleRemove = async (sourceId: number) => {
    const cfId = forecasterId ?? knowledge?.creator_forecaster_id;
    if (!cfId) return;
    setRemovingId(sourceId);
    try {
      await deleteKnowledgeSource(cfId, sourceId);
      await reload();
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-xl border border-zinc-800/70 bg-zinc-900/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !knowledge) {
    return (
      <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-6 text-center">
        <p className="text-sm text-rose-200/90">{error ?? "Knowledge unavailable"}</p>
        <button
          type="button"
          onClick={reload}
          className="mt-3 text-[12px] text-violet-400 hover:text-violet-300"
        >
          Retry
        </button>
      </div>
    );
  }

  const canUpload = Boolean(forecasterId ?? knowledge.creator_forecaster_id);

  return (
    <div className="space-y-4 pb-8">
      <div className="rounded-xl border border-violet-500/15 bg-gradient-to-br from-violet-950/40 via-zinc-950/80 to-zinc-950 p-4 sm:p-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-violet-400/80 mb-2">Research desk</p>
        <p className="text-[15px] sm:text-base text-zinc-200 leading-relaxed font-medium">
          {knowledge.training_summary}
        </p>
        <p className="text-[11px] text-zinc-500 mt-2">
          Last updated {knowledge.last_updated}
        </p>
      </div>

      <KnowledgePanel>
        <SectionHeader
          title="Knowledge sources"
          subtitle="Uploaded research that shapes conviction"
          trailing={
            <span className="text-[11px] text-emerald-300/90 tabular-nums shrink-0">
              {knowledge.active_source_count} active
            </span>
          }
        />
        {knowledge.sources.length === 0 ? (
          <p className="text-[12px] text-zinc-500 py-4">
            No sources yet — upload PDF research to build the belief layer.
          </p>
        ) : (
          <div>{knowledge.sources.map((s) => (
            <SourceRow
              key={s.id}
              source={s}
              onRemove={() => handleRemove(s.id)}
              onReplace={() => {
                replaceSourceIdRef.current = s.id;
                fileRef.current?.click();
              }}
              removing={removingId === s.id}
            />
          ))}</div>
        )}
        {canUpload && (
          <div className="mt-4 pt-3 border-t border-zinc-800/60">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f, replaceSourceIdRef.current ?? undefined);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="text-[12px] px-3 py-2 rounded-lg border border-violet-500/30 text-violet-200 bg-violet-500/10 hover:bg-violet-500/20 transition disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Add research PDF"}
            </button>
            {!forecasterId && !knowledge.creator_forecaster_id && (
              <p className="text-[11px] text-zinc-600 mt-2">
                <Link href="/create-forecaster" className="text-violet-400 hover:text-violet-300">
                  Complete forecaster setup
                </Link>{" "}
                to attach sources.
              </p>
            )}
          </div>
        )}
      </KnowledgePanel>

      <KnowledgePanel>
        <SectionHeader title="Active beliefs" subtitle="Conviction layer derived from research" />
        {knowledge.beliefs.length === 0 ? (
          <p className="text-[12px] text-zinc-500">Beliefs appear once sources are processed.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {knowledge.beliefs.map((b, i) => (
              <BeliefCard key={`${b.belief.slice(0, 40)}-${i}`} belief={b} />
            ))}
          </div>
        )}
      </KnowledgePanel>

      <div className="grid md:grid-cols-2 gap-4">
        <KnowledgePanel>
          <SectionHeader title="Agent worldview" subtitle="Personality calibration" />
          <div className="flex flex-wrap gap-1.5 mb-4">
            {knowledge.worldview.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-700/80 text-zinc-400 bg-zinc-900/50"
              >
                {tag}
              </span>
            ))}
          </div>
          <WorldviewSlidersReadonly sliders={knowledge.worldview.sliders} />
        </KnowledgePanel>

        <KnowledgePanel>
          <SectionHeader title="Forecast influence" subtitle="Which sources drive calls" />
          {knowledge.influence.length === 0 ? (
            <p className="text-[12px] text-zinc-500">Influence weights appear with active sources.</p>
          ) : (
            <InfluenceBars rows={knowledge.influence} />
          )}
        </KnowledgePanel>
      </div>

      <KnowledgePanel>
        <SectionHeader
          title="Forecast DNA"
          subtitle={`How ${profile.name} differs from the network`}
        />
        <div className="grid sm:grid-cols-2 gap-2">
          {knowledge.forecast_dna.map((m) => (
            <div
              key={m.label}
              className="rounded-lg border border-zinc-800/70 bg-zinc-900/30 px-3 py-2.5 text-[12px] text-zinc-300"
            >
              {m.label}
            </div>
          ))}
        </div>
      </KnowledgePanel>

      <KnowledgePanel>
        <SectionHeader title="Knowledge updates" subtitle="Research desk activity" />
        <ul className="space-y-0">
          {knowledge.updates.map((u, i) => (
            <li
              key={`${u.title}-${i}`}
              className="flex gap-3 py-3 border-b border-zinc-800/50 last:border-0"
            >
              <span className="text-[10px] text-zinc-600 w-14 shrink-0 pt-0.5">{u.when}</span>
              <div className="min-w-0">
                <p className="text-[12px] text-zinc-400">{u.title}</p>
                <p className="text-[12px] text-zinc-200 truncate">{u.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </KnowledgePanel>

      <div className="flex justify-end">
        <Link
          href={`/agents/${profile.slug}`}
          className="text-[11px] text-zinc-500 hover:text-violet-300 transition"
        >
          Preview public knowledge snapshot →
        </Link>
      </div>
    </div>
  );
}
