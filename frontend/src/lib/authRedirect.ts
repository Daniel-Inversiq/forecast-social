import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export function getPostAuthDestination(
  user: { onboarding_completed: boolean },
  next?: string | null,
): string {
  if (next && next !== "/" && next.startsWith("/")) return next;
  if (!user.onboarding_completed) return "/onboarding";
  return "/";
}

export function redirectToLogin(router: AppRouterInstance, returnTo?: string) {
  const next =
    returnTo ?? (typeof window !== "undefined" ? window.location.pathname : "/");
  router.push(`/login?next=${encodeURIComponent(next)}`);
}

export function isAuthRequiredError(err: unknown): boolean {
  return err instanceof Error && err.message === "AUTH_REQUIRED";
}
