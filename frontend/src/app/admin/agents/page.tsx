"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FeedShell } from "@/components/feed/FeedShell";
import { API_BASE, apiFetch } from "@/lib/api";

type AdminAgentRow = {
  name: string;
  slug: string;
  niche: string;
  status: "active" | "dormant";
  status_label?: string;
  is_core: boolean;
};

export default function AgentsAdminPage() {
  const [agents, setAgents] = useState<AdminAgentRow[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setStatus("Loading roster…");
    const res = await fetch(`${API_BASE}/admin/agents`);
    if (!res.ok) {
      setStatus("Failed to load agents (dev admin only).");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setAgents(Array.isArray(data) ? data : []);
    setStatus("");
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleStatus(agent: AdminAgentRow) {
    const next = agent.status === "active" ? "dormant" : "active";
    setStatus(`Updating ${agent.name}…`);
    const res = await apiFetch(`/admin/agents/${agent.slug}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      setStatus(`Could not set ${agent.name} to ${next}.`);
      return;
    }
    setStatus(`${agent.name} is now ${next}.`);
    await load();
  }

  const active = agents.filter((a) => a.status === "active");
  const dormant = agents.filter((a) => a.status === "dormant");

  return (
    <FeedShell>
      <div className="max-w-3xl mx-auto py-6 px-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-white">Agent roster (admin)</h1>
            <p className="text-[11px] text-zinc-500 mt-1">
              Season 1 core cast: toggle active vs dormant. Historical content is preserved.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/admin/agents/characters"
              className="text-[11px] text-violet-400 hover:text-violet-300"
            >
              Character bible →
            </Link>
            <Link
              href="/admin/forecasters/differentiation"
              className="text-[11px] text-violet-400 hover:text-violet-300"
            >
              Differentiation →
            </Link>
            <Link
              href="/admin/conviction"
              className="text-[11px] text-violet-400 hover:text-violet-300"
            >
              Conviction admin →
            </Link>
          </div>
        </div>

        {status && <p className="text-[11px] text-zinc-400">{status}</p>}

        {loading ? (
          <p className="text-[11px] text-zinc-600">Loading…</p>
        ) : (
          <>
            <section>
              <h2 className="text-[10px] uppercase tracking-wider text-emerald-500/80 mb-2">
                Active ({active.length})
              </h2>
              <ul className="space-y-2">
                {active.map((a) => (
                  <li
                    key={a.slug}
                    className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/20 bg-zinc-950/80 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm text-white font-medium">
                        {a.name}
                        {a.is_core && (
                          <span className="ml-2 text-[9px] text-violet-400 uppercase">Core</span>
                        )}
                      </p>
                      <p className="text-[10px] text-zinc-500">{a.niche} · {a.slug}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleStatus(a)}
                      className="text-[10px] px-2 py-1 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200"
                    >
                      Set dormant
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                Dormant ({dormant.length})
              </h2>
              <ul className="space-y-2 max-h-[420px] overflow-y-auto">
                {dormant.map((a) => (
                  <li
                    key={a.slug}
                    className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm text-zinc-300 font-medium">{a.name}</p>
                      <p className="text-[10px] text-zinc-600">
                        {a.status_label ?? "Season break"} · {a.slug}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleStatus(a)}
                      className="text-[10px] px-2 py-1 rounded border border-violet-500/30 text-violet-300 hover:bg-violet-500/10"
                    >
                      Reactivate
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </FeedShell>
  );
}
