/** How long fetched data counts as fresh. Opening a screen within this window does not refetch. */
export const STALE_AFTER_MS = 30_000;

/** True if data was never fetched, or was fetched more than `ttlMs` ago. */
export function isStale(lastFetchedAt: number | null, now: number = Date.now(), ttlMs: number = STALE_AFTER_MS): boolean {
  if (lastFetchedAt === null) return true;
  return now - lastFetchedAt > ttlMs;
}

/**
 * Guards what comes back from storage. A corrupt or old-format cache must be ignored, not crash the app.
 * Only the shape is checked; the items themselves were written by this app.
 */
export function isPersistedItems(value: unknown): value is { items: unknown[] } {
  return typeof value === 'object' && value !== null && Array.isArray((value as { items?: unknown }).items);
}
