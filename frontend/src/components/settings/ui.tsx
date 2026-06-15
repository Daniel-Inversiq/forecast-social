"use client";

import type { ReactNode } from "react";

export function SettingsPanel({
  title,
  description,
  children,
  badge,
}: {
  title: string;
  description?: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <section className="settings-panel rounded-2xl border border-zinc-800/80 bg-zinc-950/50 backdrop-blur-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-800/60 bg-gradient-to-r from-violet-950/25 via-transparent to-cyan-950/15">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-white tracking-tight">{title}</h2>
            {description && (
              <p className="text-[12px] text-zinc-500 mt-1 leading-relaxed max-w-xl">{description}</p>
            )}
          </div>
          {badge && (
            <span className="shrink-0 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300">
              {badge}
            </span>
          )}
        </div>
      </div>
      <div className="p-5 space-y-5">{children}</div>
    </section>
  );
}

export function SettingsField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-medium text-zinc-300">{label}</span>
      {children}
      {hint && <p className="text-[11px] text-zinc-600 leading-relaxed">{hint}</p>}
    </label>
  );
}

export function SettingsInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full h-10 px-3 text-[13px] rounded-lg bg-zinc-900/80 border border-zinc-800/90 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 transition ${props.className ?? ""}`}
    />
  );
}

export function SettingsTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full min-h-[88px] px-3 py-2.5 text-[13px] rounded-lg bg-zinc-900/80 border border-zinc-800/90 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 transition resize-y ${props.className ?? ""}`}
    />
  );
}

export function SettingsSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 px-3 text-[13px] rounded-lg bg-zinc-900/80 border border-zinc-800/90 text-zinc-100 focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 transition appearance-none cursor-pointer"
    >
      {options.map((o) => (
        <option key={o} value={o} className="bg-zinc-900">
          {o}
        </option>
      ))}
    </select>
  );
}

export function SettingsToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="settings-toggle-card flex items-center justify-between gap-4 p-4 rounded-xl border border-zinc-800/70 bg-zinc-900/30 hover:border-zinc-700/80 transition">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-zinc-200">{label}</p>
        {hint && <p className="text-[11px] text-zinc-600 mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`settings-switch shrink-0 relative w-11 h-6 rounded-full border transition ${
          checked
            ? "bg-violet-600/90 border-violet-500/50"
            : "bg-zinc-800 border-zinc-700"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

export function SettingsChipSelect({
  label,
  options,
  selected,
  onChange,
  max = 4,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  max?: number;
}) {
  function toggle(tag: string) {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
      return;
    }
    if (selected.length >= max) return;
    onChange([...selected, tag]);
  }

  return (
    <div className="space-y-2">
      <p className="text-[12px] font-medium text-zinc-300">
        {label}
        <span className="text-zinc-600 font-normal ml-1.5">
          {selected.length}/{max}
        </span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((tag) => {
          const active = selected.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                active
                  ? "border-violet-500/40 bg-violet-500/15 text-violet-200"
                  : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SettingsDivider() {
  return <div className="border-t border-zinc-800/60" />;
}

export function SettingsRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>;
}
