import { apiFetch } from "@/lib/api";

export async function createCheckoutSession(): Promise<string> {
  const res = await apiFetch("/billing/create-checkout-session", { method: "POST" });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const detail =
      data && typeof data.detail === "string"
        ? data.detail
        : "Could not start checkout";
    throw new Error(detail);
  }
  const data = (await res.json()) as { checkout_url: string };
  return data.checkout_url;
}

export async function createPortalSession(): Promise<string> {
  const res = await apiFetch("/billing/create-portal-session", { method: "POST" });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const detail =
      data && typeof data.detail === "string"
        ? data.detail
        : "Could not open billing portal";
    throw new Error(detail);
  }
  const data = (await res.json()) as { portal_url: string };
  return data.portal_url;
}
