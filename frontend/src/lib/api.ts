export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "forecast_access_token";
const IS_DEV = process.env.NODE_ENV === "development";
let loggedApiBase = false;

function joinApiUrl(path: string): string {
  const base = API_BASE.replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

/** Log resolved API base once per page load in development. */
export function logApiBaseOnce(): void {
  if (!IS_DEV || typeof window === "undefined" || loggedApiBase) return;
  loggedApiBase = true;
  console.info("[api] API_BASE =", API_BASE);
}

function warnApiFetchFailed(path: string, err: unknown): void {
  if (!IS_DEV) return;
  const message = err instanceof Error ? err.message : String(err);
  console.warn("[apiFetch failed]", {
    path,
    base: API_BASE,
    url: joinApiUrl(path),
    message,
  });
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  auth = true,
): Promise<Response> {
  logApiBaseOnce();
  const url = joinApiUrl(path);
  const headers = new Headers(options.headers);
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!headers.has("Content-Type") && options.body && !isFormData) {
    headers.set("Content-Type", "application/json");
  }
  if (auth) {
    const token = getStoredToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  try {
    return await fetch(url, { ...options, headers });
  } catch (err) {
    warnApiFetchFailed(path, err);
    throw err;
  }
}

/** Like apiFetch but never throws — returns null on network failure (for optional widgets). */
export async function apiFetchOptional(
  path: string,
  options: RequestInit = {},
  auth = true,
): Promise<Response | null> {
  try {
    return await apiFetch(path, options, auth);
  } catch {
    return null;
  }
}
