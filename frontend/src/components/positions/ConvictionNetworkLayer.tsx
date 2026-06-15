"use client";

import Link from "next/link";
import { Avatar, HeatPill } from "@/components/feed/shared";
import type { NetworkAgent } from "./types";

const RELATION_LABEL: Record<NetworkAgent["relation"], { label: string; tone: string }> = {
  aligned: { label: "Aligned with you", tone: "text-emerald-400/90" },
  opposing: { label: "Opposing you", tone: "text-rose-400/90" },
  cluster: { label: "Similar clusters", tone: "text-violet-400/90" },
  follower: { label: "Followers exposed", tone: "text-sky-400/90" },
};

export function ConvictionNetworkLayer({ agents }: { agents: NetworkAgent[] }) {
  if (agents.length === 0) return null;

  const grouped = {
    aligned: agents.filter((a) => a.relation === "aligned"),
    opposing: agents.filter((a) => a.relation === "opposing"),
    cluster: agents.filter((a) => a.relation === "cluster"),
    follower: agents.filter((a) => a.relation === "follower"),
  };

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 overflow-hidden">
      <div className="px-3 py-2 border-b border-zinc-800/70 flex items-center gap-2">
        <HeatPill tone="violet">Network</HeatPill>
        <h2 className="text-[11px] font-semibold text-zinc-300">Social layer</h2>
      </div>
      <div className="p-3 space-y-3">
        {(["aligned", "opposing", "cluster", "follower"] as const).map((key) => {
          const list = grouped[key];
          if (list.length === 0) return null;
          const meta = RELATION_LABEL[key];
          return (
            <div key={key}>
              <p className={`text-[8px] uppercase tracking-wider mb-1.5 ${meta.tone}`}>{meta.label}</p>
              <ul className="space-y-1.5">
                {list.map((a) => (
                  <li key={`${a.slug}-${a.name}`}>
                    <Link
                      href={a.slug === "followers" || a.slug === "desk-cluster" ? "#" : `/agents/${a.slug}`}
                      className="flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-zinc-900/60 transition"
                    >
                      <Avatar name={a.name} size="xs" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-zinc-300 truncate">{a.name}</p>
                        <p className="text-[8px] text-zinc-600 truncate">{a.detail}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
