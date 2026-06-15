"use client";

import { useRef, useState } from "react";
import { PresetAvatarIcon } from "@/components/agents/profile/PresetAvatarIcon";
import {
  PRESET_AVATAR_CATEGORIES,
  PRESET_AVATARS,
  type PresetAvatarCategory,
} from "@/components/agents/profile/presetAvatars";
import type { StoredProfileAvatar } from "@/components/agents/profile/useProfileAvatar";

export function AvatarPickerGrid({
  current,
  onSelect,
  previewName,
}: {
  current: StoredProfileAvatar | null;
  onSelect: (avatar: StoredProfileAvatar) => void;
  previewName: string;
}) {
  const [category, setCategory] = useState<PresetAvatarCategory>("Macro");
  const [hoverId, setHoverId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = PRESET_AVATARS.filter((a) => a.category === category);
  const currentId = current?.type === "preset" ? current.presetId : null;
  const hoverPreset = hoverId ? PRESET_AVATARS.find((a) => a.id === hoverId) : null;

  function handleUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onSelect({ type: "upload", dataUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-violet-500/15 bg-gradient-to-br from-violet-950/30 via-zinc-950/60 to-cyan-950/20">
        <AvatarPreview
          avatar={current}
          name={previewName}
          hoverPreset={hoverPreset}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-zinc-300">Avatar preview</p>
          <p className="text-[11px] text-zinc-600 mt-1">
            Upload a custom image or choose a preset orb. Changes apply on save.
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-3 text-[11px] px-3 py-1.5 rounded-lg border border-violet-500/35 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20 transition"
          >
            Upload custom avatar
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
            }}
          />
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto feed-scroll-x scrollbar-none pb-0.5">
        {PRESET_AVATAR_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`shrink-0 px-2.5 py-1 text-[10px] rounded-full border transition whitespace-nowrap ${
              category === cat
                ? "bg-violet-500/20 border-violet-500/40 text-violet-200"
                : "border-zinc-800 text-zinc-500 hover:border-zinc-600"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
        {filtered.map((preset) => {
          const selected = currentId === preset.id;
          const hovered = hoverId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelect({ type: "preset", presetId: preset.id })}
              onMouseEnter={() => setHoverId(preset.id)}
              onMouseLeave={() => setHoverId(null)}
              className={`settings-avatar-tile group flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition ${
                selected
                  ? "border-violet-400/60 bg-violet-500/15 ring-1 ring-violet-500/40 settings-avatar-selected"
                  : hovered
                    ? "border-violet-500/35 bg-zinc-900/60 settings-avatar-hover"
                    : "border-zinc-800/80 bg-zinc-900/30 hover:border-violet-500/25"
              }`}
            >
              <div
                className={`h-14 w-14 rounded-full bg-gradient-to-br ${preset.gradient} flex items-center justify-center shadow-lg ${
                  selected || hovered ? "shadow-violet-500/25" : "shadow-black/40"
                }`}
              >
                <PresetAvatarIcon icon={preset.icon} className="h-7 w-7" />
              </div>
              <span className="text-[9px] text-zinc-500 group-hover:text-zinc-300 truncate w-full text-center">
                {preset.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AvatarPreview({
  avatar,
  name,
  hoverPreset,
}: {
  avatar: StoredProfileAvatar | null;
  name: string;
  hoverPreset: { gradient: string; icon: import("@/components/agents/profile/presetAvatars").PresetAvatar["icon"] } | null | undefined;
}) {
  if (hoverPreset) {
    return (
      <div
        className={`shrink-0 h-16 w-16 rounded-2xl bg-gradient-to-br ${hoverPreset.gradient} flex items-center justify-center ring-2 ring-violet-500/30 settings-avatar-preview-glow`}
      >
        <PresetAvatarIcon icon={hoverPreset.icon} className="h-8 w-8" />
      </div>
    );
  }

  if (avatar?.type === "upload") {
    return (
      <div className="shrink-0 h-16 w-16 rounded-2xl overflow-hidden ring-2 ring-violet-500/20 settings-avatar-preview-glow">
        <img src={avatar.dataUrl} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  if (avatar?.type === "preset") {
    const preset = PRESET_AVATARS.find((a) => a.id === avatar.presetId);
    if (preset) {
      return (
        <div
          className={`shrink-0 h-16 w-16 rounded-2xl bg-gradient-to-br ${preset.gradient} flex items-center justify-center ring-2 ring-violet-500/20 settings-avatar-preview-glow`}
        >
          <PresetAvatarIcon icon={preset.icon} className="h-8 w-8" />
        </div>
      );
    }
  }

  const color = avatar?.type === "color" ? avatar.color : "#7c3aed";
  return (
    <div
      className="shrink-0 h-16 w-16 rounded-2xl flex items-center justify-center text-sm font-semibold text-white ring-2 ring-zinc-800 settings-avatar-preview-glow"
      style={{ backgroundColor: color }}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}
