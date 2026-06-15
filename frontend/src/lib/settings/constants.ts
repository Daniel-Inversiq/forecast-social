import type { SettingsSectionMeta } from "./types";

export const SETTINGS_SECTIONS: SettingsSectionMeta[] = [
  { id: "profile", label: "Profile", description: "Public forecasting identity" },
  { id: "identity", label: "Identity", description: "Style, conviction, positioning" },
  { id: "notifications", label: "Notifications", description: "Alerts and signal delivery" },
  { id: "privacy", label: "Privacy", description: "Visibility and anonymity" },
  { id: "appearance", label: "Appearance", description: "Density, glow, motion" },
  { id: "account", label: "Account", description: "Email, security, data" },
  { id: "wallet", label: "Wallet", description: "Verified wallet identity" },
  { id: "agents", label: "Agents", description: "Custom forecasting agents", comingSoon: true },
];

export const CATEGORY_TAG_OPTIONS = [
  "Macro",
  "Crypto",
  "Politics",
  "AI",
  "Rates",
  "Sports",
  "Climate",
  "Equities",
  "Contrarian",
  "Quant",
];

export const ARCHETYPE_OPTIONS = [
  "Macro specialist",
  "Early signal hunter",
  "Contrarian",
  "Consensus tracker",
  "Narrative trader",
  "Data-driven",
  "High conviction",
  "Liquidity cycle",
];

export const FORECASTING_STYLE_OPTIONS = [
  "Contrarian",
  "Consensus",
  "High conviction",
  "Data-driven",
  "Narrative trader",
  "Macro specialist",
  "Early signal hunter",
];

export const CONVICTION_TYPE_OPTIONS = [
  "Slow conviction",
  "Fast conviction",
  "Event-driven",
  "Structural thesis",
  "Tactical overlay",
];

export const POSITIONING_BEHAVIOR_OPTIONS = [
  "Early mover",
  "Consensus fade",
  "Liquidity aware",
  "Size when edge clears",
  "Scale in gradually",
  "Single flagship bet",
];

export const NOTIFICATION_TOGGLES: { key: keyof import("./types").NotificationSettings; label: string; hint: string }[] = [
  { key: "battleAlerts", label: "Battle alerts", hint: "Rivalry updates and head-to-head shifts" },
  { key: "marketMovement", label: "Market movement", hint: "Probability and volume spikes" },
  { key: "reputationChanges", label: "Reputation changes", hint: "Rank, streak, and score deltas" },
  { key: "verifiedCalls", label: "Verified call alerts", hint: "Receipts and resolved positions" },
  { key: "agentActivity", label: "Agent activity", hint: "Network identities you follow" },
  { key: "narrativeShifts", label: "Narrative shifts", hint: "Cluster momentum and theme breaks" },
  { key: "followNotifications", label: "Follow notifications", hint: "New followers and mentions" },
];

export const PRIVACY_TOGGLES: { key: keyof import("./types").PrivacySettings; label: string; hint: string }[] = [
  { key: "publicProfile", label: "Public profile", hint: "Anyone can view your forecasting identity" },
  { key: "publicPositions", label: "Public positions", hint: "Show active conviction on profile" },
  { key: "anonymousMode", label: "Anonymous mode", hint: "Mask username in public feeds" },
  { key: "hideConvictionSize", label: "Hide conviction size", hint: "Show direction without sizing" },
  { key: "showAccuracyPublicly", label: "Show accuracy publicly", hint: "Display resolved call accuracy" },
  { key: "showBattlesPublicly", label: "Show battles publicly", hint: "Display rivalry record" },
];
