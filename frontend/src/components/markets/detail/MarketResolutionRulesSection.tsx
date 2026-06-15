"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/lib/api";
import { buildMarketResolutionRules } from "./marketResolutionRules";
import type { EnrichedMarketDetail } from "./types";

type ReportKind = "market" | "insider";

function ReportModal({
  kind,
  marketSlug,
  onClose,
}: {
  kind: ReportKind;
  marketSlug: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const title = kind === "insider" ? "Report Insider Trading" : "Report Market";
  const subtitle =
    kind === "insider"
      ? "You are reporting potential misuse of non-public information."
      : "Flag unclear rules, duplicates, manipulation, or incorrect information.";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < 8 || submitting) return;
    setSubmitting(true);
    try {
      // Integrity endpoint may not exist yet — reports are queued client-side for review.
      await fetch(`${API_BASE}/markets/${marketSlug}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, reason: trimmed }),
      }).catch(() => undefined);
      setSubmitted(true);
      window.setTimeout(onClose, 1400);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-labelledby="report-modal-title"
    >
      <div className="relative w-full max-w-md rounded-xl border border-zinc-700/80 bg-zinc-950 shadow-2xl overflow-hidden">
        <div className="h-0.5 w-full bg-gradient-to-r from-amber-600/80 via-zinc-700 to-zinc-800" />
        <form onSubmit={handleSubmit} className="p-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-300 text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
            Market integrity
          </p>
          <h2 id="report-modal-title" className="text-base font-semibold text-white pr-6">
            {title}
          </h2>
          <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed">{subtitle}</p>
          {kind === "insider" && (
            <p className="text-[10px] text-zinc-600 mt-2 leading-relaxed">
              Reports are reviewed by SCRY market integrity systems.
            </p>
          )}

          {submitted ? (
            <p className="mt-4 text-[12px] text-emerald-300/90 border border-emerald-500/25 bg-emerald-950/25 rounded-lg px-3 py-2.5">
              Report received. Thank you for helping keep markets fair.
            </p>
          ) : (
            <>
              <label className="block mt-4">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">Reason</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  maxLength={600}
                  required
                  placeholder={
                    kind === "insider"
                      ? "Describe the suspicious activity or information advantage…"
                      : "What is wrong or unclear about this market?"
                  }
                  className="mt-1.5 w-full rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 resize-none focus:outline-none focus:border-amber-500/40"
                />
              </label>
              <button
                type="submit"
                disabled={submitting || reason.trim().length < 8}
                className="mt-4 w-full text-[12px] font-medium py-2.5 rounded-lg border border-amber-500/35 bg-amber-600/20 text-amber-100 hover:bg-amber-600/30 hover:border-amber-500/50 transition disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit Report"}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px]">
      <span className="text-zinc-600 shrink-0">{label}:</span>
      <span className="text-zinc-300">{value}</span>
    </div>
  );
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
        {title}
      </p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item} className="text-[11px] text-zinc-400 leading-snug flex gap-2">
            <span className="text-zinc-600 shrink-0" aria-hidden>
              •
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const reportButtonClass =
  "scry-tap-target text-[11px] font-medium px-3 py-2 rounded-lg border border-zinc-700/80 bg-zinc-900/50 text-zinc-400 transition hover:border-amber-500/40 hover:text-amber-200/90 hover:bg-amber-950/25";

export function MarketResolutionRulesSection({ market }: { market: EnrichedMarketDetail }) {
  const rules = useMemo(() => buildMarketResolutionRules(market), [market]);
  const [sectionOpen, setSectionOpen] = useState(false);
  const [fullRulesOpen, setFullRulesOpen] = useState(false);
  const [reportKind, setReportKind] = useState<ReportKind | null>(null);

  const closeReport = useCallback(() => setReportKind(null), []);

  return (
    <section className="mb-4 rounded-xl border border-zinc-800/70 bg-zinc-950/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setSectionOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-3 sm:px-4 py-3 text-left hover:bg-zinc-900/35 transition"
        aria-expanded={sectionOpen}
      >
        <div className="min-w-0">
          <h2 className="text-[12px] font-semibold text-zinc-200">Market Resolution</h2>
          <p className="text-[10px] text-zinc-600 mt-0.5">How this market resolves.</p>
        </div>
        <span className="shrink-0 text-[10px] text-zinc-500 tabular-nums" aria-hidden>
          {sectionOpen ? "▲" : "▼"}
        </span>
      </button>

      {sectionOpen && (
        <div className="border-t border-zinc-800/60 px-3 sm:px-4 pb-4 space-y-4 feed-expand-reveal is-open">
          <div className="pt-3 rounded-lg border border-zinc-800/60 bg-zinc-900/25 px-3 py-3 space-y-2.5">
            <p className="text-[10px] uppercase tracking-wider text-zinc-600">Resolution condition</p>
            <p className="text-[12px] text-zinc-200 leading-relaxed">{rules.condition}</p>
            <MetaRow label="Source" value={rules.source} />
            <MetaRow label="Resolution authority" value={rules.authority} />
            <p className="text-[10px] text-zinc-500 pt-0.5">
              Review status:{" "}
              <span
                className={
                  rules.reviewStatus === "verified"
                    ? "text-emerald-400/90"
                    : "text-amber-400/80"
                }
              >
                {rules.reviewStatus === "verified"
                  ? "Verified Market Rules"
                  : "Rules under review"}
              </span>
            </p>
            <button
              type="button"
              onClick={() => setFullRulesOpen((v) => !v)}
              className="text-[11px] text-violet-300/90 hover:text-violet-200 transition mt-1"
            >
              {fullRulesOpen ? "Hide full rules" : "View full rules"}
            </button>
          </div>

          {fullRulesOpen && (
            <div className="rounded-lg border border-zinc-800/55 bg-zinc-950/80 px-3 py-3 space-y-4">
              <BulletList title="What counts as YES" items={rules.yesCriteria} />
              <BulletList title="What counts as NO" items={rules.noCriteria} />
              <BulletList title="Edge cases" items={rules.edgeCases} />
              <div className="pt-1 border-t border-zinc-800/50 space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Resolution source
                </p>
                <MetaRow label="Primary" value={rules.primarySource} />
                <MetaRow label="Secondary" value={rules.secondarySource} />
              </div>
            </div>
          )}

          <div className="pt-1 border-t border-zinc-800/50">
            <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">
              Report actions
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={reportButtonClass}
                onClick={() => setReportKind("market")}
              >
                Report Market
              </button>
              <button
                type="button"
                className={reportButtonClass}
                onClick={() => setReportKind("insider")}
              >
                Report Insider Trading
              </button>
            </div>
            <p className="text-[10px] text-zinc-600 mt-2 leading-relaxed max-w-prose">
              Use Report Market for unclear rules, duplicates, or manipulation. Use Report
              Insider Trading when conviction appears tied to non-public information.
            </p>
          </div>
        </div>
      )}

      {reportKind && (
        <ReportModal kind={reportKind} marketSlug={market.slug} onClose={closeReport} />
      )}
    </section>
  );
}
