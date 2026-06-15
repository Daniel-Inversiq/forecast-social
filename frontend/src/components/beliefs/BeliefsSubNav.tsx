"use client";

import Link from "next/link";
import { beliefsEnabled } from "@/lib/featureFlags";

export function BeliefsSubNav({ active }: { active: "battles" | "beliefs" }) {
  if (!beliefsEnabled()) return null;
  const tabs = [
    { key: "battles" as const, label: "Battles", href: "/battles" },
    { key: "beliefs" as const, label: "Beliefs", href: "/beliefs" },
  ];
  return (
    <nav
      className="flex gap-1 p-0.5 rounded-lg border border-zinc-800/90 bg-zinc-950/80 w-fit mb-3"
      aria-label="Warfare layer"
    >
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`px-3 py-1.5 text-[11px] rounded-md transition whitespace-nowrap ${
              isActive
                ? tab.key === "beliefs"
                  ? "bg-amber-500/15 text-amber-200 border border-amber-500/30"
                  : "bg-rose-500/15 text-rose-200 border border-rose-500/30"
                : "text-zinc-500 hover:text-zinc-300 border border-transparent"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
