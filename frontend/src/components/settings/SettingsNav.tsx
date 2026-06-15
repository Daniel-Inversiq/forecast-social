"use client";

import Link from "next/link";
import { SETTINGS_SECTIONS } from "@/lib/settings/constants";
import type { SettingsSectionId } from "@/lib/settings/types";

export function SettingsNav({
  active,
  onSelect,
}: {
  active: SettingsSectionId;
  onSelect: (id: SettingsSectionId) => void;
}) {
  return (
    <nav className="settings-nav space-y-0.5" aria-label="Settings sections">
      {SETTINGS_SECTIONS.map((section) => {
        const isActive = active === section.id;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelect(section.id)}
            className={`settings-nav-item w-full text-left px-3 py-2.5 rounded-xl border transition ${
              isActive
                ? "border-violet-500/30 bg-violet-500/10 text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50 hover:border-zinc-800/60"
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="text-[13px] font-medium">{section.label}</span>
              {section.comingSoon && (
                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-600">
                  Soon
                </span>
              )}
            </span>
            <span
              className={`block text-[11px] mt-0.5 leading-snug ${
                isActive ? "text-violet-300/70" : "text-zinc-600"
              }`}
            >
              {section.description}
            </span>
          </button>
        );
      })}
      <Link
        href="/me/conviction"
        className="settings-nav-item block w-full text-left px-3 py-2.5 rounded-xl border border-violet-500/20 text-violet-200 hover:bg-violet-500/10 transition"
      >
        <span className="flex items-center gap-2">
          <span className="text-[13px] font-medium">Conviction Capital</span>
        </span>
        <span className="block text-[11px] mt-0.5 leading-snug text-violet-300/70">
          USDC balance, exposure controls, and ledger history
        </span>
      </Link>
    </nav>
  );
}
