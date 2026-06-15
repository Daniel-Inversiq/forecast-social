"use client";

import type { UserSettings } from "@/lib/settings/types";
import { SettingsField, SettingsPanel, SettingsRow, SettingsToggle } from "../ui";

const DENSITY_OPTIONS = ["compact", "comfortable", "spacious"] as const;
const GLOW_OPTIONS = ["low", "medium", "high"] as const;
const ANIMATION_OPTIONS = ["minimal", "balanced", "full"] as const;

function SegmentedControl<T extends string>({
  value,
  options,
  labels,
  onChange,
}: {
  value: T;
  options: readonly T[];
  labels?: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`flex-1 min-w-[5.5rem] text-[11px] px-3 py-2 rounded-md transition capitalize ${
            value === opt
              ? "bg-violet-500/20 text-violet-200 border border-violet-500/30"
              : "text-zinc-500 hover:text-zinc-300 border border-transparent"
          }`}
        >
          {labels?.[opt] ?? opt}
        </button>
      ))}
    </div>
  );
}

export function AppearanceSection({
  settings,
  onChange,
}: {
  settings: UserSettings;
  onChange: (patch: Partial<UserSettings["appearance"]>) => void;
}) {
  const { appearance } = settings;

  return (
    <SettingsPanel
      title="Appearance"
      description="Tune feed density, glow intensity, and motion across Scry."
    >
      <SettingsField label="Feed density">
        <SegmentedControl
          value={appearance.density}
          options={DENSITY_OPTIONS}
          labels={{ compact: "Compact", comfortable: "Comfortable", spacious: "Spacious" }}
          onChange={(density) => onChange({ density })}
        />
      </SettingsField>

      <SettingsRow>
        <SettingsField label="Glow intensity">
          <SegmentedControl
            value={appearance.glowIntensity}
            options={GLOW_OPTIONS}
            onChange={(glowIntensity) => onChange({ glowIntensity })}
          />
        </SettingsField>
        <SettingsField label="Animation level">
          <SegmentedControl
            value={appearance.animationLevel}
            options={ANIMATION_OPTIONS}
            onChange={(animationLevel) => onChange({ animationLevel })}
          />
        </SettingsField>
      </SettingsRow>

      <SettingsToggle
        label="Expanded intelligence sidebar"
        hint="Show full sidebar panels on feed and market pages"
        checked={appearance.sidebarExpanded}
        onChange={(sidebarExpanded) => onChange({ sidebarExpanded })}
      />
    </SettingsPanel>
  );
}
