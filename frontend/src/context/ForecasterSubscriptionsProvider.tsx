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
  forecasterIdsMatch,
  getSubscriptionForForecaster,
  loadSubscriptions,
  saveSubscriptions,
  type ActiveSubscription,
} from "@/lib/forecasterSubscriptions";

type ForecasterSubscriptionsContextValue = {
  subscriptions: ActiveSubscription[];
  getTier: (forecasterId: string) => "pro" | "premium" | null;
  isSubscribed: (forecasterId: string) => boolean;
  subscribe: (forecasterId: string, forecasterName: string, tier: "pro" | "premium") => void;
  unsubscribe: (forecasterId: string) => void;
  hydrated: boolean;
};

const ForecasterSubscriptionsContext =
  createContext<ForecasterSubscriptionsContextValue | null>(null);

export function ForecasterSubscriptionsProvider({ children }: { children: ReactNode }) {
  const [subscriptions, setSubscriptions] = useState<ActiveSubscription[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSubscriptions(loadSubscriptions());
    setHydrated(true);
  }, []);

  const persist = useCallback((next: ActiveSubscription[]) => {
    setSubscriptions(next);
    saveSubscriptions(next);
  }, []);

  const getTier = useCallback(
    (forecasterId: string): "pro" | "premium" | null => {
      const sub = getSubscriptionForForecaster(subscriptions, forecasterId);
      return sub?.tier ?? null;
    },
    [subscriptions],
  );

  const isSubscribed = useCallback(
    (forecasterId: string) => getTier(forecasterId) != null,
    [getTier],
  );

  const subscribe = useCallback(
    (forecasterId: string, forecasterName: string, tier: "pro" | "premium") => {
      const id = forecasterId.replace(/^agent-/, "");
      const next = subscriptions.filter((s) => !forecasterIdsMatch(s.forecasterId, id));
      next.push({
        forecasterId: id,
        forecasterName,
        tier,
        subscribedAt: new Date().toISOString(),
      });
      persist(next);
    },
    [subscriptions, persist],
  );

  const unsubscribe = useCallback(
    (forecasterId: string) => {
      const next = subscriptions.filter((s) => !forecasterIdsMatch(s.forecasterId, forecasterId));
      persist(next);
    },
    [subscriptions, persist],
  );

  const value = useMemo(
    () => ({
      subscriptions,
      getTier,
      isSubscribed,
      subscribe,
      unsubscribe,
      hydrated,
    }),
    [subscriptions, getTier, isSubscribed, subscribe, unsubscribe, hydrated],
  );

  return (
    <ForecasterSubscriptionsContext.Provider value={value}>
      {children}
    </ForecasterSubscriptionsContext.Provider>
  );
}

export function useForecasterSubscriptions() {
  const ctx = useContext(ForecasterSubscriptionsContext);
  if (!ctx) {
    throw new Error("useForecasterSubscriptions must be used within ForecasterSubscriptionsProvider");
  }
  return ctx;
}
