"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FeedShell } from "@/components/feed/FeedShell";
import { BattleWarRoom } from "@/components/battles/BattleWarRoom";
import { BeliefsSubNav } from "@/components/beliefs/BeliefsSubNav";
import { enrichBattle } from "@/components/battles/battleEnrichment";
import { FALLBACK_BATTLES } from "@/components/battles/fallbackData";
import type { Battle } from "@/components/battles/types";
import { API_BASE } from "@/lib/api";

export default function BattleDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [raw, setRaw] = useState<Battle[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/battles`);
        if (!res.ok) throw new Error("fetch failed");
        const json = await res.json();
        setRaw(Array.isArray(json) && json.length > 0 ? json : FALLBACK_BATTLES);
      } catch {
        setRaw(FALLBACK_BATTLES);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const battle = useMemo(() => {
    const list = (raw ?? FALLBACK_BATTLES).map((b, i) => enrichBattle(b, i));
    return list.find((b) => b.id === id) ?? null;
  }, [raw, id]);

  return (
    <FeedShell activeNav="Battles" hideCategoryNav>
      <BeliefsSubNav active="battles" />
      <div className="mb-3">
        <Link href="/battles" className="text-[10px] text-zinc-500 hover:text-rose-300">
          ← Battle lobby
        </Link>
      </div>

      {loading && (
        <div className="h-64 rounded-xl border border-zinc-800/60 bg-zinc-900/40 animate-pulse" />
      )}

      {!loading && !battle && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-8 text-center">
          <p className="text-zinc-400 text-sm">Battle not found.</p>
          <Link href="/battles" className="mt-3 inline-block text-[11px] text-rose-400 hover:text-rose-300">
            Return to lobby
          </Link>
        </div>
      )}

      {!loading && battle && <BattleWarRoom battle={battle} />}
    </FeedShell>
  );
}
