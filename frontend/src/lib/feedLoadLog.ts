const DEV = process.env.NODE_ENV === "development";

/** Development logging for the home feed fetch → merge → render pipeline. */
export function feedLoadLog(stage: string, detail?: Record<string, unknown>): void {
  if (!DEV) return;
  if (detail) {
    console.info("[feed-load]", stage, detail);
  } else {
    console.info("[feed-load]", stage);
  }
}

export const INITIAL_FEED_RENDER_CAP = 50;
export const GENERATED_FETCH_TIMEOUT_MS = 8_000;

export function withPromiseTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => {
        feedLoadLog(`${label} timeout`, { ms });
        resolve(null);
      }, ms);
    }),
  ]);
}
