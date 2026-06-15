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
  checkSession,
  login as authLogin,
  logout as authLogout,
  register as authRegister,
  type AuthUser,
} from "@/lib/auth";
import { getStoredToken } from "@/lib/api";
import { avatarUrlFromStored, PROFILE_AVATAR_CHANGED_EVENT, type ProfileAvatarChangedDetail } from "@/lib/avatar";
import { enrichAuthUserWithAvatar } from "@/lib/auth";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, username: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!getStoredToken()) {
      setUser(null);
      return;
    }
    const result = await checkSession();
    if (result.status === "authenticated") {
      setUser(result.user);
      return;
    }
    if (result.status === "anonymous") {
      setUser(null);
    }
    /* unavailable: keep existing user — do not clear UI on transient /auth/me failure */
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!getStoredToken()) {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      let result = await checkSession();
      if (cancelled) return;

      if (result.status === "unavailable") {
        await new Promise((r) => setTimeout(r, 1200));
        if (cancelled) return;
        result = await checkSession();
      }

      if (cancelled) return;
      if (result.status === "authenticated") setUser(result.user);
      else if (result.status === "anonymous") setUser(null);
      setLoading(false);
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    function onAvatarChanged(event: Event) {
      const { slug, avatar } = (event as CustomEvent<ProfileAvatarChangedDetail>).detail;
      setUser((prev) => {
        if (!prev || prev.username !== slug) return prev;
        return { ...prev, avatar_url: avatarUrlFromStored(avatar) };
      });
    }
    window.addEventListener(PROFILE_AVATAR_CHANGED_EVENT, onAvatarChanged);
    return () => window.removeEventListener(PROFILE_AVATAR_CHANGED_EVENT, onAvatarChanged);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authLogin(email, password);
    const enriched = enrichAuthUserWithAvatar(data.user);
    setUser(enriched);
    return enriched;
  }, []);

  const register = useCallback(
    async (email: string, username: string, password: string) => {
      const data = await authRegister(email, username, password);
      const enriched = enrichAuthUserWithAvatar(data.user);
      setUser(enriched);
      return enriched;
    },
    [],
  );

  const logout = useCallback(() => {
    authLogout();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
