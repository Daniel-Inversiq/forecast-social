"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  convictionEventsEqual,
  ensureConvictionEventSeeded,
  getConvictionEvents,
  getUnreadConvictionCount,
  markAllConvictionEventsRead,
  markConvictionEventRead,
  subscribeConvictionEventsChanged,
  type ConvictionEvent,
} from "@/lib/convictionEvents";
import { ConvictionToastStack } from "@/components/notifications/ConvictionToastStack";

type NotificationsContextValue = {
  events: ConvictionEvent[];
  unreadCount: number;
  loading: boolean;
  markNotificationRead: (id: string) => void;
  markAllNotificationsSeen: (ids?: string[]) => void;
  refreshEvents: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<ConvictionEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const syncEventsFromStore = useCallback(() => {
    const nextEvents = getConvictionEvents();
    setEvents((prev) => (convictionEventsEqual(prev, nextEvents) ? prev : nextEvents));
  }, []);

  const loadEvents = useCallback(() => {
    setLoading(true);
    ensureConvictionEventSeeded();
    syncEventsFromStore();
    setLoading(false);
  }, [syncEventsFromStore]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    return subscribeConvictionEventsChanged(() => {
      const nextEvents = getConvictionEvents();
      setEvents((prev) => (convictionEventsEqual(prev, nextEvents) ? prev : nextEvents));
    });
  }, []);

  const unreadCount = useMemo(() => getUnreadConvictionCount(events), [events]);

  const markNotificationRead = useCallback((id: string) => {
    markConvictionEventRead(id);
  }, []);

  const markAllNotificationsSeen = useCallback((ids?: string[]) => {
    markAllConvictionEventsRead(ids);
  }, []);

  const value = useMemo(
    () => ({
      events,
      unreadCount,
      loading,
      markNotificationRead,
      markAllNotificationsSeen,
      refreshEvents: loadEvents,
    }),
    [events, unreadCount, loading, markNotificationRead, markAllNotificationsSeen, loadEvents],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <ConvictionToastStack events={events} />
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return ctx;
}
