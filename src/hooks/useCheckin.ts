import { useCallback, useEffect, useRef, useState } from 'react';

import * as checkinRepository from '../services/checkinRepository';
import { useAuthStore } from '../stores/authStore';
import { useCheckinsStore } from '../stores/checkinsStore';
import type { DetailStatus } from '../types/api';
import type { Checkin } from '../types/checkin';
import { getErrorMessage, NotFoundError } from '../utils/errors';

export interface UseCheckinResult {
  data: Checkin | null;
  status: DetailStatus;
  error: string | null;
  isRefreshing: boolean;
  refetch: () => Promise<void>;
}

interface FetchState {
  status: DetailStatus;
  error: string | null;
  isRefreshing: boolean;
}

/**
 * One check-in, for the detail and edit screens.
 * If checkinsStore already has it (the user tapped it in the list) it is returned immediately with
 * no spinner, and the latest copy is fetched in the background. If not (a deep link), it loads normally.
 */
export function useCheckin(id: string): UseCheckinResult {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const cached = useCheckinsStore((s) => s.items.find((c) => c.id === id));
  const upsert = useCheckinsStore((s) => s.upsert);
  const removeLocal = useCheckinsStore((s) => s.removeLocal);

  // On mount the right starting state is already known: a cached copy means "show it, refresh quietly".
  const [fetchState, setFetchState] = useState<FetchState>({
    status: cached ? 'success' : 'loading',
    error: null,
    isRefreshing: cached !== undefined,
  });

  // Remembers the last copy we saw. An optimistic delete removes the item from the store while the
  // screen is still open, and this keeps the screen from flashing empty until it navigates away.
  const [lastSeen, setLastSeen] = useState<Checkin | null>(cached ?? null);
  if (cached && cached !== lastSeen) setLastSeen(cached);

  // Each request gets a number. A result is used only if it is still the latest request
  // (not superseded, not after unmount) and the same user is still signed in.
  const latestRequest = useRef(0);

  // Fetches and returns the screen state to show next, or null if this request was superseded.
  // It does not set state itself: callers apply the result in a callback, after the await.
  const fetchLatest = useCallback(async (): Promise<FetchState | null> => {
    if (!userId) return null;
    const request = ++latestRequest.current;
    const isCurrent = () =>
      request === latestRequest.current && useAuthStore.getState().user?.id === userId;

    try {
      const checkin = await checkinRepository.getById(id);
      if (!isCurrent()) return null;
      upsert(checkin);
      return { status: 'success', error: null, isRefreshing: false };
    } catch (e) {
      if (!isCurrent()) return null;
      if (e instanceof NotFoundError) {
        // Deleted elsewhere. Drop the stale copy so the list stops showing it.
        removeLocal(id);
        return { status: 'notFound', error: e.message, isRefreshing: false };
      }
      return { status: 'error', error: getErrorMessage(e), isRefreshing: false };
    }
  }, [id, userId, upsert, removeLocal]);

  useEffect(() => {
    void fetchLatest().then((next) => {
      if (next) setFetchState(next);
    });
    return () => {
      // Unmount: invalidate whatever is still in flight so it cannot touch state afterwards.
      latestRequest.current += 1;
    };
  }, [fetchLatest]);

  // The Retry button: put the screen back into a loading state, then run the same request.
  const refetch = useCallback(async () => {
    const hasCopy = useCheckinsStore.getState().items.some((c) => c.id === id);
    setFetchState({ status: hasCopy ? 'success' : 'loading', error: null, isRefreshing: hasCopy });
    const next = await fetchLatest();
    if (next) setFetchState(next);
  }, [id, fetchLatest]);

  const copy = cached ?? (lastSeen?.id === id ? lastSeen : null);

  return { data: copy, ...fetchState, refetch };
}
