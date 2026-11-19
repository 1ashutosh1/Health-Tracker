import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { runSync } from '../services/syncService';
import { useAuthStore } from '../stores/authStore';
import { useNetworkStore } from '../stores/networkStore';

/**
 * Decides *when* to sync; the work itself is runSync (which also makes sure two triggers never overlap).
 * Mounted once, in the root layout. It does nothing while signed out.
 *   - on login (and when the app starts with a saved session): force, so nothing waits out an old backoff
 *   - when the connection comes back: force, because a backoff set while offline means nothing now
 *   - when the app returns to the foreground: normal, so items still in backoff are left alone
 */
export function useNetworkSync(): void {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const wasOnline = useRef(isOnline);

  // Login / app start. `isOnline` is read from the store, not subscribed to: coming back online is the next effect's job.
  useEffect(() => {
    if (userId) void runSync({ force: true });
  }, [userId]);

  useEffect(() => {
    const cameBack = isOnline && !wasOnline.current;
    wasOnline.current = isOnline;
    if (cameBack && userId) void runSync({ force: true });
  }, [isOnline, userId]);

  useEffect(() => {
    if (!userId) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void runSync();
    });
    return () => subscription.remove();
  }, [userId]);
}
