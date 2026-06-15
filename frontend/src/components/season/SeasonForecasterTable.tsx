"use client";

import Link from "next/link";
import { Avatar } from "@/components/feed/shared";
import { enrichForecaster } from "./seasonEnrichment";
import { getEraAtmosphere } from "./seasonEraStyles";
import type { SeasonDetail, SeasonForecaster } from "@/lib/season";

export function SeasonForecasterTable({
  forecasters,
  season,
}: {
  forecasters: SeasonForecaster[];
  season?: SeasonDetail;
}) {
  if (forecasters.length === 0) {
    return <p className="text-[11px] text-zinc-600 py-6 text-center">No era standings archived yet.</p>;
  }

  const era = getEraAtmosphere(season?.category ?? "macro");
  const enriched = season
    ? forecasters.map((f, i) => enrichForecaster(f, season, i))
    : forecasters.map((f, i) => ({
        ...f,
        season_role: f.badges?.[0] ?? "Era forecaster",
        defining_thesis: "",
        why_mattered: "",
        narrative_ownership: "",
      }));

  return (
    <div className="space-y-3">
      {enriched.map((f, i) => (
        <Link
          key={f.agent_slug}
          href={`/agents/${f.agent_slug}`}
          className="block rounded-xl border border-zinc-800/60 bg-zinc-950/50 px-4 py-3.5 hover:border-amber-500/20 hover:bg-zinc-900/40 transition group"
        >
          <div className="flex items-start gap-3">
            <span
              className={`text-[11px] font-semibold tabular-nums w-6 shrink-0 pt-1 ${
                i === 0 ? era.accentText : "text-zinc-600"
              }`}
            >
              {f.rank ?? i + 1}
            </span>
            <Avatar name={f.agent_name} color={f.avatar_color} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <p className="text-[13px] font-semibold text-zinc-100 group-hover:text-white transition">
                  {f.agent_name}
                </p>
                {f.season_role && (
                  <span className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-zinc-800/80 text-zinc-500">
                    {f.season_role}
                  </span>
                )}
              </div>
              {f.defining_thesis && (
                <p className="text-[11px] text-zinc-400 leading-snug mb-1">{f.defining_thesis}</p>
              )}
              {f.narrative_ownership && (
                <p className="text-[9px] text-zinc-600 mb-1">Owns · {f.narrative_ownership}</p>
              )}
              {f.why_mattered && (
                <p className="text-[10px] text-zinc-600 leading-relaxed">{f.why_mattered}</p>
              )}
            </div>
            <div className="text-right shrink-0 pt-0.5">
              <p className={`text-[12px] font-semibold tabular-nums ${era.accentText}`}>
                +{f.reputation_delta}
              </p>
              {f.calibration_score != null && (
                <p className="text-[9px] text-zinc-600 mt-0.5">{f.calibration_score} cal</p>
              )}
              {f.verified_calls != null && f.verified_calls > 0 && (
                <p className="text-[9px] text-zinc-600">{f.verified_calls} receipts</p>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
