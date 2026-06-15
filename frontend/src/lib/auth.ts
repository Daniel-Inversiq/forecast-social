import {
  API_BASE,
  apiFetch,
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from "@/lib/api";
import { avatarUrlFromStored, loadStoredAvatar } from "@/lib/avatar";

export function enrichAuthUserWithAvatar(user: AuthUser): AuthUser {
  const stored = loadStoredAvatar(user.username);
  return {
    ...user,
    avatar_url: avatarUrlFromStored(stored),
  };
}

export type AuthUser = {
  id: number;
  email: string;
  username: string;
  bio: string | null;
  avatar_color: string | null;
  /** Client-enriched from local custom upload; API may add this later. */
  avatar_url?: string | null;
  reputation_score: number;
  onboarding_completed: boolean;
  intelligence_tier: "free" | "intelligence_access";
  intelligence_subscription_status: string | null;
  intelligence_current_period_end: string | null;
  has_billing_customer: boolean;
  wallet_address: string | null;
  wallet_address_short: string | null;
  wallet_chain: string | null;
  wallet_chain_label: string | null;
  ens_name: string | null;
  wallet_verified: boolean;
  wallet_connected_at: string | null;
  created_at: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

export async function register(
  email: string,
  username: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const detail =
      data && typeof data.detail === "string"
        ? data.detail
        : "Registration failed";
    throw new Error(detail);
  }
  const data = (await res.json()) as AuthResponse;
  setStoredToken(data.access_token);
  return data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const detail =
      data && typeof data.detail === "string"
        ? data.detail
        : "Invalid email or password";
    throw new Error(detail);
  }
  const data = (await res.json()) as AuthResponse;
  setStoredToken(data.access_token);
  return data;
}

export function logout(): void {
  clearStoredToken();
}

export function isLoggedIn(): boolean {
  return Boolean(getStoredToken());
}

/** Result of a session probe — distinguishes real logout from transient API failure. */
export type SessionCheckResult =
  | { status: "authenticated"; user: AuthUser }
  | { status: "anonymous" }
  | { status: "unavailable" };

/**
 * Validate the stored access token against `/auth/me`.
 * Only `401` clears the token. Network/5xx leave storage intact (`unavailable`).
 */
export async function checkSession(): Promise<SessionCheckResult> {
  if (!getStoredToken()) return { status: "anonymous" };
  try {
    const res = await apiFetch("/auth/me");
    if (res.status === 401) {
      clearStoredToken();
      if (process.env.NODE_ENV === "development") {
        console.warn("[auth] session cleared: GET /auth/me → 401");
      }
      return { status: "anonymous" };
    }
    if (!res.ok) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[auth] session check skipped:", res.status, res.statusText);
      }
      return { status: "unavailable" };
    }
    const user = enrichAuthUserWithAvatar((await res.json()) as AuthUser);
    return { status: "authenticated", user };
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[auth] session check failed (network):", msg);
    }
    return { status: "unavailable" };
  }
}

/** @deprecated Prefer checkSession() when you must not treat 5xx as logout. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const result = await checkSession();
  if (result.status === "authenticated") return result.user;
  if (result.status === "anonymous") return null;
  return null;
}
