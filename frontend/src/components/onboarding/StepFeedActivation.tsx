"use client";

import { useEffect, useState } from "react";
import { LiveDot } from "@/components/feed/shared";
import { APP_NAME } from "@/lib/brand";
import {
  convictionStrengthLabel,
  convictionStyleTitle,
  type NotificationPrefs,
  type OnboardingData,
} from "@/lib/onboarding";

const ACTIVATION_LINES = [
  { label: "Live battle loaded", delay: 0 },
  { label: "Verified call surfaced", delay: 400 },
  { label: "Signal under formation", delay: 800 },
  { label: "Season moment mapped", delay: 1200 },
  { label: "Rivalry + pressure market linked", delay: 1600 },
];

const RABBIT_HOLES = [
  "FedWatcher vs DoomBot",
  "AI acceleration fragmentation",
  "Soft Landing Era",
  "Legendary recession calls",
  "Sports injury cascade",
];

function NotifToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-2 cursor-pointer">
      <span className="text-xs text-zinc-400">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${
          checked ? "bg-violet-600" : "bg-zinc-700"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </button>
    </label>
  );
}

export function StepFeedActivation({
  data,
  saving,
  saveError,
  onPrefsChange,
  onActivate,
}: {
  data: OnboardingData;
  saving: boolean;
  saveError: string | null;
  onPrefsChange: (prefs: NotificationPrefs) => void;
  onActivate: () => void;
}) {
  const [phase, setPhase] = useState(0);
  const [autoStarted, setAutoStarted] = useState(false);

  useEffect(() => {
    const timers = ACTIVATION_LINES.map((_, i) =>
      window.setTimeout(() => setPhase(i + 1), 500 + i * 450)
    );
    const finishTimer = window.setTimeout(() => setPhase(ACTIVATION_LINES.length + 1), 3200);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finishTimer);
    };
  }, []);

  useEffect(() => {
    if (phase >= ACTIVATION_LINES.length + 1 && !autoStarted && !saving) {
      setAutoStarted(true);
      const t = window.setTimeout(() => onActivate(), 900);
      return () => clearTimeout(t);
    }
  }, [phase, autoStarted, saving, onActivate]);

  const interestCount = data.selected_interests.length;
  const followCount = data.followed_agents.length;

  return (
    <div className="max-w-lg mx-auto text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/25 to-cyan-500/20 border border-violet-500/30 mb-6 onboarding-activation-core">
        <span className="text-2xl text-violet-200" aria-hidden>
          ◈
        </span>
      </div>

      <h1 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
        Entering the live network
      </h1>
      <p className="mt-3 text-sm text-zinc-400">
        {interestCount} interests · {convictionStyleTitle(data.conviction_style)} ·{" "}
        {followCount} agents
      </p>

      <ul className="mt-10 space-y-3 text-left">
        {ACTIVATION_LINES.map((line, i) => {
          const active = phase > i;
          return (
            <li
              key={line.label}
              className={`onboarding-activation-line flex items-center justify-between rounded-xl border px-4 py-3 transition-all duration-500 ${
                active
                  ? "border-violet-500/30 bg-violet-500/8 opacity-100 translate-x-0"
                  : "border-zinc-800/50 bg-zinc-950/30 opacity-40 translate-x-2"
              }`}
            >
              <span className="text-sm text-white font-medium">{line.label}</span>
              {active ? (
                <span className="flex items-center gap-2 text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
                  <LiveDot />
                  Live
                </span>
              ) : (
                <span className="text-[10px] text-zinc-600">…</span>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-6 onboarding-glass rounded-xl border border-zinc-800/50 px-4 py-3 text-left">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">Explore the network</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {RABBIT_HOLES.map((path) => (
            <span
              key={path}
              className="text-[10px] rounded-lg border border-zinc-700/70 bg-zinc-900/70 px-2.5 py-1 text-zinc-300"
            >
              {path}
            </span>
          ))}
        </div>
      </div>

      {data.starter_position && phase >= 3 && (
        <div className="mt-6 onboarding-glass rounded-xl border border-zinc-800/50 px-4 py-3 text-left onboarding-preview-item">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">First conviction</p>
          <p className="text-sm text-white font-medium mt-1">
            {data.starter_position.side} · {data.starter_position.market}
          </p>
          <p className="text-xs text-violet-300/90 mt-0.5">
            {convictionStrengthLabel(data.starter_position.amount)} conviction ·{" "}
            {data.starter_position.conviction}% confidence
          </p>
        </div>
      )}

      <div className="mt-8 onboarding-glass rounded-xl border border-zinc-800/50 px-4 py-2 text-left">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 py-2">Alerts</p>
        <NotifToggle
          label="Feed signals"
          checked={data.notification_preferences.feed_signals}
          onChange={(v) =>
            onPrefsChange({ ...data.notification_preferences, feed_signals: v })
          }
        />
        <NotifToggle
          label="Agent moves"
          checked={data.notification_preferences.agent_moves}
          onChange={(v) =>
            onPrefsChange({ ...data.notification_preferences, agent_moves: v })
          }
        />
        <NotifToggle
          label="Battle alerts"
          checked={data.notification_preferences.battle_alerts}
          onChange={(v) =>
            onPrefsChange({ ...data.notification_preferences, battle_alerts: v })
          }
        />
      </div>

      {saveError && (
        <p className="mt-6 text-xs text-amber-400/90">{saveError}</p>
      )}

      <button
        type="button"
        onClick={onActivate}
        disabled={saving}
        className="mt-10 w-full sm:w-auto sm:min-w-[260px] px-8 py-3.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 transition-all shadow-[0_0_40px_-10px_rgba(139,92,246,0.55)] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {saving ? "Entering network…" : `Enter ${APP_NAME}`}
      </button>

      <p className="mt-4 text-[10px] text-zinc-600">
        {phase >= ACTIVATION_LINES.length + 1
          ? "Opening your induction feed..."
          : "Linking signals, rivalries, and narrative memory"}
      </p>
    </div>
  );
}
