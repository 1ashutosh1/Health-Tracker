import { useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { isStale } from '../domain/cache';
import { useAuthStore } from '../stores/authStore';
import { useCheckinsStore } from '../stores/checkinsStore';
import type { AsyncStatus } from '../types/api';
import type { Checkin } from '../types/checkin';

export interface UseCheckinsResult {
  data: Checkin[];
  status: AsyncStatus;
  /** A message that is safe to show, or null. */
  error: string | null;
  /** A reload is running and `data` is already on screen. First loads are `status === 'loading'` with this false. */
  isRefreshing: boolean;
  /** For the Retry button and pull-to-refresh. Resolves when the request ends (it never throws). */
  refetch: () => Promise<void>;
}

/**
 * The list of check-ins. All the real state lives in checkinsStore so every screen shares it;
 * this hook only decides *when* to load: on mount, if nothing was fetched yet or it is over 30s old.
 */
export function useCheckins(): UseCheckinsResult {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const fetchAll = useCheckinsStore((s) => s.fetchAll);
  const { items, status, error, lastFetchedAt } = useCheckinsStore(
    useShallow((s) => ({
      items: s.items,
      status: s.status,
      error: s.error,
      lastFetchedAt: s.lastFetchedAt,
    })),
  );

  useEffect(() => {
    // Read the freshness at mount time instead of subscribing to it, or every finished fetch would re-run this.
    if (userId && isStale(useCheckinsStore.getState().lastFetchedAt)) void fetchAll(userId);
  }, [userId, fetchAll]);

  const refetch = useCallback(() => (userId ? fetchAll(userId) : Promise.resolve()), [userId, fetchAll]);

  return {
    data: items,
    status,
    error,
    isRefreshing: status === 'loading' && lastFetchedAt !== null,
    refetch,
  };
}
