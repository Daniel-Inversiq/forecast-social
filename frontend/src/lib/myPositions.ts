import type { PositionsPayload } from "@/components/positions/types";
import { apiFetch } from "@/lib/api";

const CACHE_KEY = "forecast_my_positions_v1";
const HAD_POSITIONS_KEY = "forecast_had_positions";

export const EMPTY_MY_POSITIONS: PositionsPayload = {
  active_positions: [],
  resolved_positions: [],
  stats: {
    active_count: 0,
    resolved_count: 0,
    accuracy: 0,
    total_conviction_volume: 0,
  },
  timeline: [],
};

export function hasMyPositions(payload: PositionsPayload): boolean {
  return payload.active_positions.length > 0 || payload.resolved_positions.length > 0;
}

function isValidPayload(json: unknown): json is PositionsPayload {
  if (!json || typeof json !== "object") return false;
  const o = json as PositionsPayload;
  return (
    !!o.stats &&
    Array.isArray(o.active_positions) &&
    Array.isArray(o.resolved_positions) &&
    Array.isArray(o.timeline)
  );
}

export function readCachedMyPositions(): PositionsPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedMyPositions(payload: PositionsPayload): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    sessionStorage.setItem(HAD_POSITIONS_KEY, hasMyPositions(payload) ? "1" : "0");
  } catch {
    /* quota / private mode */
  }
}

function userPreviouslyHadPositions(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(HAD_POSITIONS_KEY) === "1";
}

export type FetchMyPositionsResult = {
  data: PositionsPayload;
  source: "api" | "cache" | "empty";
  /** True when refresh failed but cached payload was returned. */
  usedStaleCache: boolean;
  /** Show recoverable refresh warning (positions known, no fallback). */
  showRefreshError: boolean;
};

function logFetchError(err: unknown): void {
  if (process.env.NODE_ENV === "production") return;
  console.error("[MyPositions] /me/positions failed", err);
}

/**
 * Loads the conviction ledger from the API, with session cache and a safe empty fallback
 * when the backend is unreachable (typical local dev without the API running).
 */
export async function fetchMyPositions(): Promise<FetchMyPositionsResult> {
  try {
    const response = await apiFetch("/me/positions");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json: unknown = await response.json();
    if (!isValidPayload(json)) throw new Error("Invalid response");
    writeCachedMyPositions(json);
    return {
      data: json,
      source: "api",
      usedStaleCache: false,
      showRefreshError: false,
    };
  } catch (err) {
    logFetchError(err);

    const cached = readCachedMyPositions();
    if (cached) {
      return {
        data: cached,
        source: "cache",
        usedStaleCache: true,
        showRefreshError: false,
      };
    }

    const showRefreshError = userPreviouslyHadPositions();
    return {
      data: EMPTY_MY_POSITIONS,
      source: "empty",
      usedStaleCache: false,
      showRefreshError,
    };
  }
}
