/** Product beliefs layer (idea battles) — off for beta unless explicitly enabled. */
export function beliefsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_BELIEFS === "true";
}
