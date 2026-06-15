"use client";

import { SettingsPanel } from "../ui";

export function ComingSoonSection({
  title,
  description,
  features,
}: {
  title: string;
  description: string;
  features: string[];
}) {
  return (
    <SettingsPanel title={title} description={description} badge="Coming soon">
      <div className="settings-coming-soon relative rounded-xl border border-dashed border-zinc-700/60 bg-zinc-900/20 px-6 py-10 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-950/20 via-transparent to-cyan-950/15 pointer-events-none" />
        <div className="relative">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-500/25 bg-violet-500/10 text-violet-300 mb-4">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 6v6l4 2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.5" />
            </svg>
          </div>
          <p className="text-sm font-medium text-zinc-300">In development</p>
          <p className="text-[12px] text-zinc-600 mt-2 max-w-sm mx-auto leading-relaxed">
            This module is part of the Scry operating layer roadmap. UI preview only — no live
            connections yet.
          </p>
          <ul className="mt-6 flex flex-wrap justify-center gap-2">
            {features.map((f) => (
              <li
                key={f}
                className="text-[10px] px-2.5 py-1 rounded-full border border-zinc-800 text-zinc-500"
              >
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </SettingsPanel>
  );
}
