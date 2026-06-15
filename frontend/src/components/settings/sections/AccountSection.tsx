"use client";

import Link from "next/link";
import type { UserSettings } from "@/lib/settings/types";
import { BetaDisclosure } from "@/components/trust/BetaDisclosure";
import { SettingsDivider, SettingsField, SettingsInput, SettingsPanel } from "../ui";

export function AccountSection({
  settings,
  onAccountChange,
}: {
  settings: UserSettings;
  onAccountChange: (patch: Partial<UserSettings["account"]>) => void;
}) {
  return (
    <div className="space-y-5">
      <SettingsPanel title="Account" description="Email, security, and data management.">
        <SettingsField label="Email address">
          <SettingsInput
            type="email"
            value={settings.account.email}
            onChange={(e) => onAccountChange({ email: e.target.value })}
          />
        </SettingsField>

        <SettingsDivider />

        <div className="space-y-3">
          <ActionRow
            title="Change password"
            description="Update your sign-in credentials"
            actionLabel="Update"
            onAction={() => {}}
          />
          <ActionRow
            title="Active sessions"
            description="Manage devices signed into Scry"
            actionLabel="Review"
            onAction={() => {}}
          />
          <ActionRow
            title="Export data"
            description="Download your forecasts, positions, and settings"
            actionLabel="Export"
            onAction={() => {}}
          />
        </div>
      </SettingsPanel>

      <SettingsPanel
        title="Responsibility & disclosures"
        description="Legal notices and beta product disclaimers for your account."
      >
        <BetaDisclosure
          includePositionSimulation
          tone="muted"
          heading="Responsibility statement"
        />
        <nav className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px]">
          <Link href="/terms" className="text-violet-400/90 hover:text-violet-300 transition">
            Terms of use
          </Link>
          <Link href="/privacy" className="text-zinc-500 hover:text-zinc-300 transition">
            Privacy policy
          </Link>
          <Link href="/risk" className="text-zinc-500 hover:text-zinc-300 transition">
            Risk disclosure
          </Link>
        </nav>
        <p className="text-[10px] text-zinc-600 mt-3 leading-relaxed">
          Trust tier requirements and distribution standing are managed in your{" "}
          <Link href="/reputation" className="text-violet-400/90 hover:text-violet-300">
            reputation hub
          </Link>
          , not on your public profile.
        </p>
      </SettingsPanel>

      <SettingsPanel title="Danger zone" description="Irreversible account actions.">
        <ActionRow
          title="Delete account"
          description="Permanently remove your forecasting identity and data"
          actionLabel="Delete"
          variant="danger"
          onAction={() => {}}
        />
      </SettingsPanel>
    </div>
  );
}

function ActionRow({
  title,
  description,
  actionLabel,
  onAction,
  variant = "default",
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  variant?: "default" | "danger";
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-zinc-800/70 bg-zinc-900/25">
      <div>
        <p className="text-[13px] font-medium text-zinc-200">{title}</p>
        <p className="text-[11px] text-zinc-600 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        onClick={onAction}
        className={`shrink-0 text-[11px] px-3 py-1.5 rounded-lg border transition ${
          variant === "danger"
            ? "border-rose-500/30 text-rose-300 bg-rose-500/10 hover:bg-rose-500/20"
            : "border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-violet-500/30"
        }`}
      >
        {actionLabel}
      </button>
    </div>
  );
}
