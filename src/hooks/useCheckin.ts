import { useCallback, useEffect, useRef, useState } from 'react';

import { isLocalId } from '../domain/sync';
import * as checkinRepository from '../services/checkinRepository';
import { refreshNetworkStatus } from '../services/networkMonitor';
import { useAuthStore } from '../stores/authStore';
import { useCheckinsStore } from '../stores/checkinsStore';
import { useOutboxStore } from '../stores/outboxStore';
import type { DetailStatus } from '../types/api';
import type { Checkin } from '../types/checkin';
import { getErrorMessage, isNetworkError, NetworkError, NotFoundError } from '../utils/errors';
import { useIsMounted } from './useIsMounted';
import { useIsOnline } from './useIsOnline';

export interface UseCheckinResult {
  data: Checkin | null;
  status: DetailStatus;
  error: string | null;
  isRefreshing: boolean;
  /** No connection, so `data` is the saved copy. */
  isOffline: boolean;
  refetch: () => Promise<void>;
}

interface FetchState {
  status: DetailStatus;
  error: string | null;
  isRefreshing: boolean;
}

const SHOWING_COPY: FetchState = { status: 'success', error: null, isRefreshing: false };

/** True if either store has this check-in right now. Read at call time, not subscribed to. */
const hasCopy = (id: string) =>
  useOutboxStore.getState().items.some((c) => c.id === id) ||
  useCheckinsStore.getState().items.some((c) => c.id === id);

/**
 * One check-in, for the detail and edit screens.
 * If a store already has it (the user tapped it in the list) it is returned immediately with
 * no spinner, and the latest copy is fetched in the background. If not (a deep link), it loads normally.
 * Offline, or for a check-in that only exists on this device, no request is made: the saved copy is the answer.
 */
export function useCheckin(id: string): UseCheckinResult {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isOnline = useIsOnline();
  const pending = useOutboxStore((s) => s.items.find((c) => c.id === id));
  const synced = useCheckinsStore((s) => s.items.find((c) => c.id === id));
  const cached = pending ?? synced;
  const upsert = useCheckinsStore((s) => s.upsert);
  const removeLocal = useCheckinsStore((s) => s.removeLocal);

  // On mount the right starting state is already known: a cached copy means "show it, refresh quietly".
  const [fetchState, setFetchState] = useState<FetchState>({
    status: cached ? 'success' : 'loading',
    error: null,
    isRefreshing: cached !== undefined && !isLocalId(id),
  });

  // Remembers the last copy we saw. An optimistic delete removes the item from the store while the
  // screen is still open, and this keeps the screen from flashing empty until it navigates away.
  const [lastSeen, setLastSeen] = useState<Checkin | null>(cached ?? null);
  if (cached && cached !== lastSeen) setLastSeen(cached);

  // When the server accepts a pending check-in it gets a new id and the old "local_" one disappears.
  // Follow it by clientId so a screen that was open on it carries on instead of showing "not found".
  const followed = useCheckinsStore((s) =>
    cached || !lastSeen ? undefined : s.items.find((c) => c.clientId === lastSeen.clientId),
  );

  // Each request gets a number. A result is used only if it is still the latest request
  // (not superseded, not after unmount) and the same user is still signed in.
  const latestRequest = useRef(0);
  const isMounted = useIsMounted();

  // Fetches and returns the screen state to show next, or null if this request was superseded.
  // It does not set state itself: callers apply the result in a callback, after the await.
  const fetchLatest = useCallback(async (): Promise<FetchState | null> => {
    if (!userId) return null;
    const request = ++latestRequest.current;
    const isCurrent = () =>
      request === latestRequest.current && useAuthStore.getState().user?.id === userId;

    // The server has never heard of a "local_" id, so there is nothing to ask it.
    if (isLocalId(id)) return SHOWING_COPY;

    // With a connection problem the saved copy is the best answer; without one there is nothing to show.
    const noConnection = (message: string): FetchState =>
      hasCopy(id) ? SHOWING_COPY : { status: 'error', error: message, isRefreshing: false };

    if (!isOnline) return noConnection(new NetworkError().message);

    try {
      const checkin = await checkinRepository.getById(id);
      if (!isCurrent()) return null;
      upsert(checkin);
      return SHOWING_COPY;
    } catch (e) {
      if (!isCurrent()) return null;
      if (e instanceof NotFoundError) {
        // Deleted elsewhere. Drop the stale copy so the list stops showing it.
        removeLocal(id);
        return { status: 'notFound', error: e.message, isRefreshing: false };
      }
      if (isNetworkError(e)) return noConnection(getErrorMessage(e));
      return { status: 'error', error: getErrorMessage(e), isRefreshing: false };
    }
  }, [id, userId, isOnline, upsert, removeLocal]);

  // Runs on mount, and again when the connection changes (back online: refresh the saved copy).
  useEffect(() => {
    void fetchLatest().then((next) => {
      if (next && isMounted()) setFetchState(next);
    });
    return () => {
      // Unmount: invalidate whatever is still in flight so it cannot touch state afterwards.
      latestRequest.current += 1;
    };
  }, [fetchLatest, isMounted]);

  // The Retry button: put the screen back into a loading state, then run the same request.
  const refetch = useCallback(async () => {
    if (!isOnline) await refreshNetworkStatus();
    // Left the screen while the connection was being checked: nothing to show a result on.
    if (!isMounted()) return;
    const keepsCopy = hasCopy(id);
    setFetchState({ status: keepsCopy ? 'success' : 'loading', error: null, isRefreshing: keepsCopy && !isLocalId(id) });
    const next = await fetchLatest();
    if (next && isMounted()) setFetchState(next);
  }, [id, isOnline, fetchLatest, isMounted]);

  const copy = cached ?? followed ?? (lastSeen?.id === id ? lastSeen : null);
  // A device-only id with no copy anywhere (a stale link): nothing will ever load it.
  const status = !copy && isLocalId(id) ? 'notFound' : fetchState.status;

  return { data: copy, ...fetchState, status, isOffline: !isOnline, refetch };
}
