"use client";

import { useRef, useState } from "react";
import { PresetAvatarIcon } from "./PresetAvatarIcon";
import {
  PRESET_AVATAR_CATEGORIES,
  PRESET_AVATARS,
  type PresetAvatarCategory,
} from "./presetAvatars";
import type { StoredProfileAvatar } from "./useProfileAvatar";

export function AvatarPickerModal({
  open,
  onClose,
  onSelect,
  current,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (avatar: StoredProfileAvatar) => void;
  current: StoredProfileAvatar | null;
}) {
  const [category, setCategory] = useState<PresetAvatarCategory>("Macro");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const filtered = PRESET_AVATARS.filter((a) => a.category === category);
  const currentId = current?.type === "preset" ? current.presetId : null;

  function handleUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onSelect({ type: "upload", dataUrl: reader.result });
        onClose();
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm scry-backdrop-dismiss"
        onClick={onClose}
        aria-label="Close avatar picker"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-picker-title"
        className="relative w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl border border-violet-500/20 bg-zinc-950/95 shadow-2xl shadow-violet-950/40 flex flex-col"
      >
        <div className="px-4 py-3 border-b border-zinc-800/80 bg-gradient-to-r from-violet-950/40 to-zinc-950/90">
          <h2 id="avatar-picker-title" className="text-sm font-semibold text-white">
            Forecasting identity avatar
          </h2>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Upload custom or select a preset — saved locally for this profile
          </p>
        </div>

        <div className="px-4 py-3 border-b border-zinc-800/60 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-[10px] px-3 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20 transition"
          >
            Upload image
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

        <div className="px-4 pt-3 flex gap-1 overflow-x-auto feed-scroll-x scrollbar-none pb-1">
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

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 sm:grid-cols-4 gap-2.5">
          {filtered.map((preset) => {
            const selected = currentId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  onSelect({ type: "preset", presetId: preset.id });
                  onClose();
                }}
                className={`group flex flex-col items-center gap-1.5 p-2 rounded-xl border transition feed-hover-lift ${
                  selected
                    ? "border-violet-400/50 bg-violet-500/10 ring-1 ring-violet-500/30"
                    : "border-zinc-800/80 bg-zinc-900/40 hover:border-violet-500/30"
                }`}
              >
                <div
                  className={`h-14 w-14 rounded-full bg-gradient-to-br ${preset.gradient} flex items-center justify-center shadow-lg shadow-violet-950/30`}
                >
                  <PresetAvatarIcon icon={preset.icon} className="h-7 w-7" />
                </div>
                <span className="text-[9px] text-zinc-400 group-hover:text-zinc-300 truncate w-full text-center">
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-zinc-800/80 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
