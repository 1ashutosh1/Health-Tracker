import { useCallback, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { isStale } from '../domain/cache';
import { mergeWithOutbox } from '../domain/sync';
import { refreshNetworkStatus } from '../services/networkMonitor';
import { useAuthStore } from '../stores/authStore';
import { useCheckinsStore } from '../stores/checkinsStore';
import { useNetworkStore } from '../stores/networkStore';
import { useOutboxStore } from '../stores/outboxStore';
import type { AsyncStatus } from '../types/api';
import type { Checkin } from '../types/checkin';
import { NetworkError } from '../utils/errors';
import { useIsOnline } from './useIsOnline';

export interface UseCheckinsResult {
  /** Check-ins waiting to sync first, then the server's. The same list for every screen, the dashboard included. */
  data: Checkin[];
  status: AsyncStatus;
  /** A message that is safe to show, or null. */
  error: string | null;
  /** A reload is running and `data` is already on screen. First loads are `status === 'loading'` with this false. */
  isRefreshing: boolean;
  /** No connection, so `data` may be a saved copy. Screens show the offline banner instead of an error. */
  isOffline: boolean;
  /** For the Retry button and pull-to-refresh. Resolves when the request ends (it never throws). */
  refetch: () => Promise<void>;
}

const NO_ITEMS: Checkin[] = [];

/**
 * The list of check-ins. All the real state lives in the stores so every screen shares it;
 * this hook decides *when* to load and what the screens should be told:
 *  - It waits until the saved copy has been read from disk, so a screen never says "empty" too early.
 *  - It loads on mount if nothing was fetched yet or the data is over 30s old, but never while offline.
 *  - Offline, the saved copy is the answer. A failed request with data on screen is "offline", not an error.
 *  - Check-ins still waiting to sync are merged in, so they show up (and count) like any other.
 */
export function useCheckins(): UseCheckinsResult {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isOnline = useIsOnline();
  const fetchAll = useCheckinsStore((s) => s.fetchAll);
  const { items, status, error, errorIsNetwork, lastFetchedAt, ownerUserId, hasHydrated } = useCheckinsStore(
    useShallow((s) => ({
      items: s.items,
      status: s.status,
      error: s.error,
      errorIsNetwork: s.errorIsNetwork,
      lastFetchedAt: s.lastFetchedAt,
      ownerUserId: s.ownerUserId,
      hasHydrated: s.hasHydrated,
    })),
  );
  const pending = useOutboxStore((s) => s.items);

  // A saved copy that belongs to somebody else is not ours to show. (null = nothing fetched yet.)
  const ownsCache = ownerUserId === null || ownerUserId === userId;
  const data = useMemo(() => mergeWithOutbox(pending, ownsCache ? items : NO_ITEMS), [pending, items, ownsCache]);

  useEffect(() => {
    if (!userId || !hasHydrated || !isOnline) return;
    // Read the freshness at this moment instead of subscribing to it, or every finished fetch would re-run this.
    const s = useCheckinsStore.getState();
    if (isStale(s.ownerUserId === userId ? s.lastFetchedAt : null)) void fetchAll(userId);
  }, [userId, hasHydrated, isOnline, fetchAll]);

  const refetch = useCallback(async () => {
    if (!userId) return;
    if (!useNetworkStore.getState().isOnline) {
      // We think we are offline, but the user asked: look again before giving up.
      await refreshNetworkStatus();
      if (!useNetworkStore.getState().isOnline) return;
    }
    await fetchAll(userId);
  }, [userId, fetchAll]);

  const hasData = data.length > 0;
  const knowsServerState = ownsCache && lastFetchedAt !== null;

  let shownStatus = status;
  let shownError = error;
  if (!hasHydrated) {
    shownStatus = 'loading';
    shownError = null;
  } else if (!isOnline) {
    // Never fetched while offline. With data (or a saved "you have none") that is simply the answer;
    // with nothing saved at all there is nothing to show, which is a real error.
    if (hasData || knowsServerState) {
      shownStatus = 'success';
      shownError = null;
    } else {
      shownStatus = 'error';
      shownError = new NetworkError().message;
    }
  } else if (status === 'error' && errorIsNetwork && hasData) {
    shownStatus = 'success';
    shownError = null;
  }

  return {
    data,
    status: shownStatus,
    error: shownError,
    isRefreshing: shownStatus === 'loading' && lastFetchedAt !== null,
    isOffline: !isOnline || (hasHydrated && status === 'error' && errorIsNetwork),
    refetch,
  };
}
