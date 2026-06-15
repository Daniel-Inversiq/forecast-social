"use client";

import { useMemo, useState } from "react";
import { FALLBACK_BELIEFS } from "./fallbackData";
import { beliefsEnabled } from "@/lib/featureFlags";
import { titleToSlug } from "@/lib/slugs";

export function BeliefPicker({
  value,
  onChange,
  allowCreate = true,
}: {
  value: { slug: string; title: string } | null;
  onChange: (belief: { slug: string; title: string } | null) => void;
  allowCreate?: boolean;
}) {
  const [mode, setMode] = useState<"select" | "create">("select");
  const [newTitle, setNewTitle] = useState("");

  const options = useMemo(
    () =>
      FALLBACK_BELIEFS.map((b) => ({ slug: b.slug, title: b.title })).sort((a, b) =>
        a.title.localeCompare(b.title),
      ),
    [],
  );

  function handleCreate() {
    const title = newTitle.trim();
    if (!title) return;
    onChange({ slug: titleToSlug(title), title });
    setNewTitle("");
    setMode("select");
  }

  if (!beliefsEnabled()) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">Belief</span>
        {allowCreate && (
          <button
            type="button"
            onClick={() => setMode(mode === "select" ? "create" : "select")}
            className="text-[10px] text-amber-400/90 hover:text-amber-300"
          >
            {mode === "select" ? "Create new belief" : "Pick existing"}
          </button>
        )}
      </div>

      {mode === "select" ? (
        <select
          value={value?.slug ?? ""}
          onChange={(e) => {
            const slug = e.target.value;
            if (!slug) {
              onChange(null);
              return;
            }
            const found = options.find((o) => o.slug === slug);
            onChange(found ?? { slug, title: slug });
          }}
          className="w-full min-h-[40px] rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500/40"
        >
          <option value="">— Attach to belief (optional) —</option>
          {options.map((o) => (
            <option key={o.slug} value={o.slug}>
              {o.title}
            </option>
          ))}
        </select>
      ) : (
        <div className="flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New belief thesis…"
            className="flex-1 min-h-[40px] rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 text-sm text-zinc-100 focus:outline-none focus:border-amber-500/40"
          />
          <button
            type="button"
            onClick={handleCreate}
            className="shrink-0 px-3 rounded-lg border border-amber-500/30 text-[11px] text-amber-200 bg-amber-500/10 hover:bg-amber-500/15"
          >
            Add
          </button>
        </div>
      )}

      {value && (
        <p className="text-[10px] text-amber-200/70 border border-amber-500/20 rounded-md px-2 py-1 bg-amber-500/5">
          {value.title}
        </p>
      )}
    </div>
  );
}
