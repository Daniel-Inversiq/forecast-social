/** Canonical backend receipt id (receipt-event-42, receipt-take-17, receipt-position-3). */
export function isCanonicalReceiptId(id: string): boolean {
  return /^receipt-(event|take|fallback|position)-\d+$/i.test(id);
}

/** Display id shown on cards (SCR-000042). */
export function displayReceiptId(canonicalId: string): string {
  const digits = canonicalId.replace(/\D/g, "").slice(-6);
  return `SCR-${(digits || "0").padStart(6, "0")}`;
}

export function receiptDetailPath(canonicalId: string): string {
  return `/receipts/${encodeURIComponent(canonicalId)}`;
}

/** Resolve route param to canonical id when possible. */
export function normalizeReceiptRouteId(routeId: string): string {
  const decoded = decodeURIComponent(routeId);
  if (isCanonicalReceiptId(decoded)) return decoded;
  if (/^SCR-\d{6}$/i.test(decoded)) {
    const suffix = decoded.replace(/^SCR-/i, "");
    return decoded;
  }
  return decoded;
}

/** Match SCR display id against a canonical receipt id. */
export function scrMatchesCanonical(scrOrRoute: string, canonicalId: string): boolean {
  const upper = scrOrRoute.toUpperCase();
  if (isCanonicalReceiptId(scrOrRoute)) return scrOrRoute === canonicalId;
  if (/^SCR-\d{6}$/i.test(upper)) {
    return displayReceiptId(canonicalId).toUpperCase() === upper;
  }
  return scrOrRoute === canonicalId;
}

export function findReceiptByRouteId<T extends { id: string }>(
  receipts: T[],
  routeId: string,
): T | undefined {
  const decoded = decodeURIComponent(routeId);
  return receipts.find(
    (r) => r.id === decoded || scrMatchesCanonical(decoded, r.id),
  );
}
