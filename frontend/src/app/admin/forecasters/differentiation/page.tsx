"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FeedShell } from "@/components/feed/FeedShell";
import { API_BASE, apiFetch } from "@/lib/api";

type AdminDiffRow = {
  id: number;
  display_name: string;
  username: string;
  agent_slug: string | null;
  published_at: string | null;
  similarity_score: number;
  differentiation_score: number;
  level: string;
  closest_match: { slug: string; name: string };
  overlap_reasons: string[];
  needs_review: boolean;
};

type AdminDiffOverview = {
  distribution: Record<string, number>;
  newest: AdminDiffRow[];
  clone_risk: AdminDiffRow[];
  too_close: AdminDiffRow[];
  total_published: number;
};

const LEVEL_COLOR: Record<string, string> = {
  distinct: "text-emerald-400",
  some_overlap: "text-sky-400",
  too_close: "text-amber-400",
  clone_risk: "text-rose-400",
};

function RowActions({
  row,
  onAction,
}: {
  row: AdminDiffRow;
  onAction: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function run(path: string) {
    setBusy(true);
    const res = await apiFetch(path, { method: "POST", body: JSON.stringify({}) });
    setBusy(false);
    if (res.ok) onAction();
  }

  return (
    <div className="flex gap-2 shrink-0">
      <button
        type="button"
        disabled={busy}
        onClick={() => run(`/admin/forecasters/${row.id}/force-review`)}
        className="text-[10px] px-2 py-1 rounded border border-amber-500/30 text-amber-300 hover:bg-amber-950/30 disabled:opacity-50"
      >
        Force review
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => run(`/admin/forecasters/${row.id}/archive`)}
        className="text-[10px] px-2 py-1 rounded border border-rose-500/30 text-rose-300 hover:bg-rose-950/30 disabled:opacity-50"
      >
        Archive
      </button>
    </div>
  );
}

function ForecasterRow({
  row,
  onAction,
}: {
  row: AdminDiffRow;
  onAction: () => void;
}) {
  return (
    <li className="rounded-lg border border-zinc-800/80 bg-zinc-950/80 px-3 py-2 space-y-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] text-white font-medium">
            {row.display_name}{" "}
            <span className="text-zinc-500 font-normal">@{row.username}</span>
          </p>
          <p className="text-[11px] text-zinc-500">
            Closest: {row.closest_match.name} · diff {row.differentiation_score}/100 · sim{" "}
            {row.similarity_score}/100
          </p>
          <p className={`text-[11px] capitalize ${LEVEL_COLOR[row.level] ?? "text-zinc-400"}`}>
            {row.level.replace("_", " ")}
          </p>
        </div>
        <RowActions row={row} onAction={onAction} />
      </div>
      {row.overlap_reasons.length > 0 && (
        <p className="text-[10px] text-zinc-600">{row.overlap_reasons.join(" · ")}</p>
      )}
      {row.agent_slug && (
        <Link href={`/agents/${row.agent_slug}`} className="text-[10px] text-violet-400 hover:text-violet-300">
          View profile →
        </Link>
      )}
    </li>
  );
}

export default function AdminDifferentiationPage() {
  const [data, setData] = useState<AdminDiffOverview | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setStatus("Loading differentiation overview…");
    const res = await fetch(`${API_BASE}/admin/forecasters/differentiation`);
    if (!res.ok) {
      setStatus("Failed to load (dev admin only).");
      setLoading(false);
      return;
    }
    setData(await res.json());
    setStatus("");
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dist = data?.distribution;

  return (
    <FeedShell>
      <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-white">Creator differentiation (admin)</h1>
            <p className="text-[11px] text-zinc-500 mt-1">
              Newest published creator forecasters, closest matches, and clone-risk flags.
            </p>
          </div>
          <Link href="/admin/agents" className="text-[11px] text-violet-400 hover:text-violet-300">
            Agent roster →
          </Link>
        </div>

        {status && <p className="text-[11px] text-zinc-400">{status}</p>}

        {loading || !data ? (
          <p className="text-[11px] text-zinc-600">Loading…</p>
        ) : (
          <>
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["distinct", "some_overlap", "too_close", "clone_risk"] as const).map((key) => (
                <div
                  key={key}
                  className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 py-2 text-center"
                >
                  <p className={`text-lg font-semibold tabular-nums ${LEVEL_COLOR[key]}`}>
                    {dist?.[key] ?? 0}
                  </p>
                  <p className="text-[10px] text-zinc-500 capitalize">{key.replace("_", " ")}</p>
                </div>
              ))}
            </section>

            <section>
              <h2 className="text-[10px] uppercase tracking-wider text-rose-500/80 mb-2">
                Clone risk ({data.clone_risk.length})
              </h2>
              <ul className="space-y-2">
                {data.clone_risk.length === 0 ? (
                  <li className="text-[11px] text-zinc-600">None flagged.</li>
                ) : (
                  data.clone_risk.map((row) => (
                    <ForecasterRow key={row.id} row={row} onAction={load} />
                  ))
                )}
              </ul>
            </section>

            <section>
              <h2 className="text-[10px] uppercase tracking-wider text-amber-500/80 mb-2">
                Too close ({data.too_close.length})
              </h2>
              <ul className="space-y-2">
                {data.too_close.length === 0 ? (
                  <li className="text-[11px] text-zinc-600">None.</li>
                ) : (
                  data.too_close.map((row) => (
                    <ForecasterRow key={row.id} row={row} onAction={load} />
                  ))
                )}
              </ul>
            </section>

            <section>
              <h2 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                Newest published ({data.newest.length})
              </h2>
              <ul className="space-y-2">
                {data.newest.map((row) => (
                  <ForecasterRow key={row.id} row={row} onAction={load} />
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </FeedShell>
  );
}
