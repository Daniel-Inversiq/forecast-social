import type { EnrichedAlert } from "@/components/alerts/types";

export const NOTIFICATIONS_SEEN_STORAGE_KEY = "scry-notifications-seen-v1";

export const NOTIFICATIONS_CHANGED_EVENT = "scry-notifications-changed";

type NotificationsSeenState = {
  readIds: string[];
};

let seenIdsCache: Set<string> | null = null;

function loadSeenState(): NotificationsSeenState {
  if (typeof window === "undefined") return { readIds: [] };
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_SEEN_STORAGE_KEY);
    if (!raw) return { readIds: [] };
    const parsed = JSON.parse(raw) as NotificationsSeenState;
    return { readIds: Array.isArray(parsed.readIds) ? parsed.readIds : [] };
  } catch {
    return { readIds: [] };
  }
}

function saveSeenState(state: NotificationsSeenState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NOTIFICATIONS_SEEN_STORAGE_KEY, JSON.stringify(state));
}

export function invalidateNotificationsSeenCache() {
  seenIdsCache = null;
}

export function getSeenNotificationIds(): Set<string> {
  if (seenIdsCache) return seenIdsCache;
  seenIdsCache = new Set(loadSeenState().readIds);
  return seenIdsCache;
}

/** Unread critical attention items and unread alerts not yet marked seen locally. */
export function isNotificationUnread(alert: EnrichedAlert, seenIds?: Set<string>): boolean {
  const seen = seenIds ?? getSeenNotificationIds();
  if (seen.has(alert.id)) return false;
  return alert.unread || alert.urgencyLabel === "Critical";
}

export function getUnreadNotificationCount(
  alerts: EnrichedAlert[],
  seenIds?: Set<string>,
): number {
  const seen = seenIds ?? getSeenNotificationIds();
  return alerts.filter((a) => isNotificationUnread(a, seen)).length;
}

function persistSeenIds(seen: Set<string>) {
  seenIdsCache = seen;
  saveSeenState({ readIds: [...seen] });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  }
}

export function markNotificationRead(id: string) {
  const seen = getSeenNotificationIds();
  if (seen.has(id)) return;
  seen.add(id);
  persistSeenIds(seen);
}

export function markAllNotificationsSeen(ids: string[]) {
  if (ids.length === 0) return;
  const seen = getSeenNotificationIds();
  let changed = false;
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      changed = true;
    }
  }
  if (changed) persistSeenIds(seen);
}

export function subscribeNotificationsChanged(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChange);
  return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChange);
}
