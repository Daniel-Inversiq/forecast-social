"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthProvider";

export function useRequireAuth(returnTo?: string) {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const next = returnTo ?? (typeof window !== "undefined" ? window.location.pathname : "/");
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [user, loading, router, returnTo]);

  return { user, loading, refreshUser, isAuthenticated: Boolean(user) };
}
