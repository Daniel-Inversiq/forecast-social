export type AccountMenuLink = {
  label: string;
  href: string;
  /** Matches FeedShell `activeNav` prop for highlight */
  activeNavKey?: string;
};

/** Personal account surfaces (dropdown + mobile). */
export const ACCOUNT_MENU_ACCOUNT_ITEMS: AccountMenuLink[] = [
  { label: "Following", href: "/following", activeNavKey: "Following" },
  { label: "Positions", href: "/me/positions", activeNavKey: "Positions" },
  { label: "Receipts", href: "/verified-calls", activeNavKey: "Receipts" },
  { label: "Seasons", href: "/season", activeNavKey: "Seasons" },
];

const ACCOUNT_MENU_DROPDOWN_ACCOUNT: AccountMenuLink[] = [
  { label: "Following", href: "/following", activeNavKey: "Following" },
  { label: "Positions", href: "/me/positions", activeNavKey: "Positions" },
  { label: "Receipts", href: "/verified-calls", activeNavKey: "Receipts" },
];

/** Dropdown groups — no section labels, separators only. */
export const ACCOUNT_MENU_DROPDOWN_GROUPS: AccountMenuLink[][] = [
  ACCOUNT_MENU_DROPDOWN_ACCOUNT,
  [
    { label: "Documentation", href: "/docs" },
    { label: "Help Center", href: "/help" },
  ],
  [
    { label: "Terms of Service", href: "/terms" },
    { label: "Privacy Policy", href: "/privacy" },
  ],
];

export const ACCOUNT_MENU_SETTINGS: AccountMenuLink = {
  label: "Settings",
  href: "/settings",
  activeNavKey: "Settings",
};

/** Flat list for mobile nav / legacy imports (account + settings). */
export const ACCOUNT_NAV: { label: string; href: string }[] = [
  ...ACCOUNT_MENU_ACCOUNT_ITEMS.map(({ label, href }) => ({ label, href })),
  { label: ACCOUNT_MENU_SETTINGS.label, href: ACCOUNT_MENU_SETTINGS.href },
];
