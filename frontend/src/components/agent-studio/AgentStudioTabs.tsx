"use client";

export type AgentStudioTabKey =
  | "dashboard"
  | "reads"
  | "audience"
  | "revenue"
  | "knowledge"
  | "settings";

const TABS: { key: AgentStudioTabKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "reads", label: "Reads" },
  { key: "audience", label: "Audience" },
  { key: "revenue", label: "Revenue" },
  { key: "knowledge", label: "Knowledge" },
  { key: "settings", label: "Settings" },
];

export function AgentStudioTabs({
  active,
  onChange,
}: {
  active: AgentStudioTabKey;
  onChange: (tab: AgentStudioTabKey) => void;
}) {
  return (
    <div className="profile-tabs-bar sticky top-[44px] sm:top-[48px] z-30 -mx-0.5 px-0.5 py-2 mb-3 border-b border-zinc-800/80 bg-zinc-950/92 backdrop-blur-md">
      <div className="flex gap-1 overflow-x-auto feed-scroll-x scrollbar-none pb-0.5">
        {TABS.map(({ key, label }) => {
          const isActive = active === key;
          const isSettings = key === "settings";
          const isKnowledge = key === "knowledge";
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={`profile-tab-btn shrink-0 px-3 py-1.5 text-[11px] rounded-lg border transition whitespace-nowrap ${
                isActive
                  ? isSettings
                    ? "border-zinc-700/90 text-zinc-300 bg-zinc-900/80"
                    : isKnowledge
                      ? "profile-tab-active text-white border-transparent bg-violet-950/40"
                      : "profile-tab-active text-white border-transparent"
                  : isSettings
                    ? "border-transparent text-zinc-600 hover:text-zinc-400 bg-transparent"
                    : "border-zinc-800/90 text-zinc-500 hover:border-violet-500/30 hover:text-zinc-300 bg-zinc-950/60"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
