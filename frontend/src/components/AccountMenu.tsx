"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AccountMenuWatchSection } from "@/components/AccountMenuWatchSection";
import { useAuth } from "@/context/AuthProvider";
import {
  ACCOUNT_MENU_DROPDOWN_GROUPS,
  ACCOUNT_MENU_SETTINGS,
  type AccountMenuLink,
} from "@/lib/accountMenu";
import { pathnameMatchesNav } from "@/lib/nav";

function MenuSeparator() {
  return <div className="mx-2.5 my-0.5 border-t border-zinc-800/60" role="separator" />;
}

function menuItemClass(isActive: boolean, tone: "primary" | "secondary" | "muted") {
  const base =
    "block w-full rounded-md px-2.5 py-1.5 text-[13px] leading-none whitespace-nowrap transition-colors duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-zinc-600/70";

  if (tone === "muted") {
    return `${base} ${
      isActive
        ? "text-zinc-300 bg-zinc-800/50"
        : "text-zinc-500 hover:text-zinc-400 hover:bg-zinc-800/35"
    }`;
  }
  if (tone === "secondary") {
    return `${base} ${
      isActive
        ? "text-zinc-200 bg-zinc-800/55"
        : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40"
    }`;
  }
  return `${base} ${
    isActive
      ? "text-zinc-100 bg-zinc-800/65"
      : "text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/45"
  }`;
}

function MenuLink({
  item,
  isActive,
  tone,
  onSelect,
}: {
  item: AccountMenuLink;
  isActive: boolean;
  tone: "primary" | "secondary";
  onSelect: () => void;
}) {
  return (
    <Link
      href={item.href}
      role="menuitem"
      tabIndex={-1}
      onClick={onSelect}
      className={menuItemClass(isActive, tone)}
    >
      {item.label}
    </Link>
  );
}

export function AccountMenu({
  activeNav,
  align = "right",
}: {
  activeNav?: string;
  align?: "left" | "right";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  function linkIsActive(item: AccountMenuLink) {
    const key = item.activeNavKey ?? item.label;
    if (item.activeNavKey && activeNav === item.activeNavKey) return true;
    if (!item.activeNavKey) {
      return pathname === item.href || pathname.startsWith(`${item.href}/`);
    }
    return activeNav === key || pathnameMatchesNav(pathname, key, item.href);
  }

  const focusMenuItems = useCallback(() => {
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    items?.[0]?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.requestAnimationFrame(() => focusMenuItems());
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      window.cancelAnimationFrame(t);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open, close, focusMenuItems]);

  function onMenuKeyDown(e: React.KeyboardEvent) {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    if (items.length === 0) return;

    const current = document.activeElement as HTMLElement;
    const idx = items.indexOf(current);

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const next = idx < 0 ? 0 : (idx + 1) % items.length;
        items[next]?.focus();
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prev = idx <= 0 ? items.length - 1 : idx - 1;
        items[prev]?.focus();
        break;
      }
      case "Home": {
        e.preventDefault();
        items[0]?.focus();
        break;
      }
      case "End": {
        e.preventDefault();
        items[items.length - 1]?.focus();
        break;
      }
      case "Tab": {
        close();
        break;
      }
      default:
        break;
    }
  }

  function handleLogout() {
    close();
    logout();
    router.push("/");
  }

  const settingsActive = linkIsActive(ACCOUNT_MENU_SETTINGS);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        aria-label="Account menu"
        className="scry-tap-target p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors duration-150"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKeyDown}
          className={`absolute top-full mt-1.5 z-[80] w-[280px] max-w-[calc(100vw-1.5rem)] rounded-lg border border-zinc-800/70 bg-zinc-950/98 backdrop-blur-md shadow-lg shadow-black/40 py-1 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {ACCOUNT_MENU_DROPDOWN_GROUPS.map((group, groupIndex) => (
            <div key={groupIndex}>
              {groupIndex > 0 && <MenuSeparator />}
              <div className="px-1">
                {group.map((item) => (
                  <MenuLink
                    key={item.href}
                    item={item}
                    isActive={linkIsActive(item)}
                    tone={groupIndex === 0 ? "primary" : "secondary"}
                    onSelect={close}
                  />
                ))}
              </div>
              {groupIndex === 0 && user && (
                <>
                  <MenuSeparator />
                  <AccountMenuWatchSection open={open} onNavigate={close} />
                </>
              )}
            </div>
          ))}

          <MenuSeparator />

          <div className="px-1">
            <Link
              href={ACCOUNT_MENU_SETTINGS.href}
              role="menuitem"
              tabIndex={-1}
              onClick={close}
              className={menuItemClass(settingsActive, "primary")}
            >
              {ACCOUNT_MENU_SETTINGS.label}
            </Link>
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={handleLogout}
              className={menuItemClass(false, "muted")}
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
